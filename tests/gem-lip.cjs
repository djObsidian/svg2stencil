const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

(async () => {
    const root = path.resolve(__dirname, '..');
    const THREE = await import(pathToFileURL(path.join(root, 'vendor/three/three.module.js')));
    async function addon(file) {
        const source = fs.readFileSync(path.join(root, 'vendor/three/addons', file), 'utf8')
            .replaceAll("from 'three'", `from ${JSON.stringify(pathToFileURL(path.join(root, 'vendor/three/three.module.js')).href)}`);
        return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    }
    const { mergeVertices, mergeGeometries } = await addon('utils/BufferGeometryUtils.js');
    const { STLExporter } = await addon('exporters/STLExporter.js');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const input = value => ({ value });
    const c = vm.createContext({
        THREE, mergeVertices, mergeGeometries, STLExporter, Blob,
        scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
        controls: { target: new THREE.Vector3(), update() {} },
        widthInput: input(138), heightInput: input(115), thicknessInput: input(0.12),
        lipEnabledInput: { checked: false }, lipOppositeInput: { checked: false },
        lipHeightInput: input(1.2), lipWallInput: input(1.2), lipClearanceInput: input(0.15),
        highDetailInput: { checked: false }, nozzleInput: input(0),
        infoText: {}, downloadBtn: {}, t: () => () => '',
        URL: { createObjectURL(blob) { c.blob = blob; return 'test.stl'; } },
        document: { createElement() { return { click() {} }; } },
    });
    vm.runInContext('let svgBounds, apertures, edgeCutsContour, stencilMesh, lipMesh;\n' +
        html.slice(html.indexOf('        function parseGerber('), html.indexOf('        function isGerber(')), c);
    c.paste = fs.readFileSync(path.join(__dirname, 'fixtures/GEM_Pcb.GBP'), 'utf8');
    c.board = fs.readFileSync(path.join(__dirname, 'fixtures/GEM_Pcb.GM'), 'utf8');
    vm.runInContext(`apertures = parseGerber(paste); edgeCutsContour = parseEdgeCuts(board)[0];
        globalThis.centers = apertures.map(ap => ({
            x: ap.reduce((s,p) => s+p.x,0)/ap.length-svgBounds.minX-svgBounds.width/2,
            y: -(ap.reduce((s,p) => s+p.y,0)/ap.length-svgBounds.minY-svgBounds.height/2)
        }));`, c);
    assert.equal(c.centers.length, 470);
    function covered(mesh) {
        mesh.updateMatrixWorld(true);
        return Array.from(c.centers, p => new THREE.Raycaster(
            new THREE.Vector3(p.x, p.y, 3), new THREE.Vector3(0, 0, -1)
        ).intersectObject(mesh).length > 0);
    }
    const generate = () => vm.runInContext('generateStencil(); globalThis.mesh = stencilMesh;', c);
    for (const nozzle of [0, 0.4]) {
        c.nozzleInput.value = nozzle;
        c.lipEnabledInput.checked = false;
        generate();
        const reference = covered(c.mesh); // Original ExtrudeGeometry aperture behavior.
        if (nozzle === 0) assert.ok(reference.every(v => !v), 'all 470 apertures are open');
        for (const opposite of [false, true]) {
            c.lipEnabledInput.checked = true;
            c.lipOppositeInput.checked = opposite;
            generate();
            assert.deepEqual(covered(c.mesh), reference, 'preview preserves apertures when enabling lip');
            vm.runInContext('downloadSTL()', c);
            const data = new DataView(await c.blob.arrayBuffer());
            const vertices = [];
            for (let i = 0; i < data.getUint32(80, true); i++) {
                for (let j = 0; j < 9; j++) vertices.push(data.getFloat32(84+i*50+12+j*4, true));
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
            assert.deepEqual(covered(new THREE.Mesh(geometry, material)), reference, 'binary STL preserves preview apertures');
            geometry.dispose(); material.dispose();
            console.log(`GEM GM/GBP: 470 aperture positions match without/with lip, preview/STL; nozzle=${nozzle}, opposite=${opposite}`);
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const paste = fs.readFileSync('tests/fixtures/GEM_Pcb.GBP', 'utf8');
for (const folder of ['.']) {
    const html = fs.readFileSync(`${folder}/index.html`, 'utf8');
    const extract = (start, end) => html.slice(html.indexOf(`        function ${start}(`), html.indexOf(end, html.indexOf(`        function ${start}(`)));
    const context = vm.createContext({});
    vm.runInContext('let svgBounds;\n' + extract('parseGerber', '        // Parse edge cuts') +
        extract('parseEdgeCuts', '        function offsetPolygon(') +
        extract('isGerber', '        function loadFile('), context);
    assert.equal(context.isGerber('tests/fixtures/GEM_Pcb.GM'), true);
    assert.equal(context.isGerber('board.gm1'), true);
    const contours = context.parseEdgeCuts(fs.readFileSync('tests/fixtures/GEM_Pcb.GM', 'utf8'));
    assert.equal(contours.length, 1);
    const bounds = pts => [Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x)), Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y))];
    assert.deepEqual(bounds(contours[0]), [126,97.1]);
    let checked = 0;
    for (const match of paste.matchAll(/%AM(ROUNDEDRECTD\d+)\*([\s\S]*?)%/g)) {
        const bar = match[2].trim().split('*')[0].split(',').map(Number);
        const bars = match[2].split('*').map(s=>s.trim().split(',').map(Number)).filter(p=>p[0]===21);
        const angle = bar[6]*Math.PI/180;
        const file = `%FSLAX45Y45*%\n%MOMM*%\n${match[0]}\n%ADD10${match[1]}*%\nD10*\nX0Y0D03*\nM02*`;
        const polygons = context.parseGerber(file);
        assert.equal(polygons.length, 1);
        assert.equal(polygons[0].length, 36, match[1] + ': rounded outline');
        const local = polygons[0].map(p=>({x:p.x*Math.cos(angle)-p.y*Math.sin(angle),y:p.x*Math.sin(angle)+p.y*Math.cos(angle)}));
        const [w,h] = bounds(local);
        assert.ok(Math.abs(w-Math.max(...bars.map(p=>p[2])))<1e-8, match[1]+': width');
        assert.ok(Math.abs(h-Math.max(...bars.map(p=>p[3])))<1e-8, match[1]+': height');
        const area = Math.abs(polygons[0].reduce((a,p,i,pts)=>{ const q=pts[(i+1)%pts.length]; return a+p.x*q.y-q.x*p.y; },0)/2);
        const r = match[2].split('*').map(s=>s.trim().split(',').map(Number)).find(p=>p[0]===1)[2]/2;
        assert.ok(Math.abs(area-(w*h-(4-Math.PI)*r*r))<0.0005, match[1]+': area');
        checked++;
    }
    const all = context.parseGerber(paste);
    assert.ok(all.length > 100);
    assert.ok(all.every(pts=>pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
    const oldPaste = context.parseGerber(fs.readFileSync('tests/fixtures/shield_pcb_small.GTP','utf8'));
    assert.ok(oldPaste.length > 0);
    assert.ok(context.parseEdgeCuts(fs.readFileSync('tests/fixtures/shield_pcb_small.GM1','utf8')).length > 0);
    console.log(`${folder}: GM outline 126 x 97.1 mm; ${checked} rotated macros; ${all.length} GEM apertures; legacy fixtures OK`);
}


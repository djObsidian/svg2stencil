const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const folder of ['..', ...process.argv.slice(2)]) {
    const root = path.resolve(__dirname, folder);
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const c = vm.createContext({ ClipperLib: require('../vendor/clipper/clipper.js') });
    vm.runInContext('let svgBounds;\n' + html.slice(html.indexOf('        function parseGerber('),
        html.indexOf('        // Build the stepped solid')), c);
    const area = polys => polys.reduce((sum, p) => sum + Math.abs(c.signedArea(p)) -
        (p.islands || []).reduce((a, island) => a + Math.abs(c.signedArea(island)), 0), 0);
    const rotate = (polys, angle) => polys.map(p => p.map(({x,y}) => ({
        x: x*Math.cos(angle)-y*Math.sin(angle), y: x*Math.sin(angle)+y*Math.cos(angle)
    })));
    const rounded = (cx, cy, w = 0.5, h = 0.8, r = 0.125) => {
        const pts = [];
        for (let k=0; k<4; k++) for (let j=0; j<=8; j++) {
            const a = (k+j/8)*Math.PI/2;
            pts.push({ x: cx + (k===0 || k===3 ? 1 : -1)*(w/2-r)+r*Math.cos(a),
                y: cy + (k<2 ? 1 : -1)*(h/2-r)+r*Math.sin(a) });
        }
        return pts;
    };
    const contains = (p, x, y) => {
        let inside = false;
        for (let i=0,j=p.length-1; i<p.length; j=i++) {
            const a=p[i], b=p[j];
            if ((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside;
        }
        return inside && !(p.islands || []).some(island => contains(island,x,y));
    };
    const checkArea = (input, output) => assert.ok(Math.abs(area(input)-area(output)) < 2e-5,
        `paste area preserved: ${area(input)} -> ${area(output)}`);

    // A 0.3 mm wall must not change its merge decision due to floating point noise after rotation.
    const pair = [rounded(0,0), rounded(0.8,0)];
    for (const angle of [0, Math.PI/2, Math.PI, 0.37]) {
        const input = rotate(pair, angle);
        assert.equal(c.mergeNearbyApertures(input, 0.3).length, 2, `0.3 mm wall, angle=${angle}`);
        const merged = c.mergeNearbyApertures(input, 0.4);
        assert.equal(merged.length, 1);
        assert.ok(merged[0].length>8, 'rounded ends survive merging');
        checkArea(input, merged);
    }
    assert.equal(c.mergeNearbyApertures(pair,0), pair, 'disabled merge preserves originals');
    const single = [rounded(0,0)];
    assert.equal(c.mergeNearbyApertures(single,0.4), single);

    // AABB overlap is not a distance test: these rotated long pads remain far apart.
    const diagonal = rotate([rounded(0,0,3,0.2,0.05),rounded(0,0.7,3,0.2,0.05)],Math.PI/4);
    assert.equal(c.mergeNearbyApertures(diagonal,0.4).length,2,'separated diagonal pads');
    const nearDiagonal = rotate(pair,Math.PI/4);
    assert.equal(c.mergeNearbyApertures(nearDiagonal,0.4).length,1,'near diagonal pads');

    // Local connections must follow the arc, leaving its center and concavity intact.
    const arc = Array.from({length:9},(_,i) => {
        const a=i*Math.PI/8;
        return rotate([rounded(0,0,0.8,0.5)],a-Math.PI/2)[0].map(p=>({x:p.x+2.5*Math.cos(a),y:p.y+2.5*Math.sin(a)}));
    });
    for (const nozzle of [0.3,0.4]) {
        const merged = c.mergeNearbyApertures(arc,nozzle);
        assert.ok(merged.length<arc.length,'semicircle neighbors merge');
        assert.ok(merged.every(p=>!contains(p,0,1)),'semicircle stays concave');
        checkArea(arc,merged);
    }
    const ring = arc.slice(0,-1).concat(rotate(arc.slice(0,-1),Math.PI));
    const mergedRing = c.mergeNearbyApertures(ring,0.4);
    assert.equal(mergedRing.length,1,'closed curved row merges');
    assert.equal(mergedRing[0].islands.length,1,'solid center of a ring survives');
    assert.equal(contains(mergedRing[0],0,0),false);
    checkArea(ring,mergedRing);

    const paste = fs.readFileSync(path.join(__dirname,'fixtures/GEM_Pcb.GBP'),'utf8');
    const gem = c.parseGerber(paste);
    const topArc = gem.filter(p => p.every(v => v.x>95 && v.x<115 && v.y>-114 && v.y<-106));
    assert.ok(topArc.length>=10,'real GEM semicircle fixture selected');
    for (const nozzle of [0.3,0.4]) {
        assert.ok(c.mergeNearbyApertures(topArc,nozzle).every(p=>topArc.includes(p)),
            'GEM semicircle has printable contour gaps; rounded apertures remain untouched');
        const merged = c.mergeNearbyApertures(gem,nozzle);
        checkArea(gem,merged);
        assert.ok(merged.every(p=>p.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y))));
        // A rigid 90 degree rotation must produce the same groups and total paste area.
        const turned = c.mergeNearbyApertures(rotate(gem,Math.PI/2),nozzle);
        assert.equal(turned.length,merged.length,'GEM orientation independence');
        assert.ok(Math.abs(area(turned)-area(merged))<2e-5);
        const reordered = c.mergeNearbyApertures(gem.slice().reverse(),nozzle);
        assert.equal(reordered.length,merged.length,'independent of aperture input order');
        assert.ok(Math.abs(area(reordered)-area(merged))<2e-5);
        console.log(`${root}: GEM nozzle=${nozzle}: ${gem.length} -> ${merged.length} apertures; area preserved`);
    }
    console.log(`${root}: merge thresholds, rotation, rounded ends and semicircle OK`);
}

import * as THREE from 'three';
import { Gyro } from './vr.js';
import { Ambience } from './audio.js';

const $ = id => document.getElementById(id);
const KEY = 'vr-orbital-settings', mobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
const S = Object.assign({ q: mobile ? 1 : 2, ipd: 63, fov: 80, muted: false }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const QN = ['Low', 'Medium', 'High'], maxPR = Math.min(devicePixelRatio, [1, 1.5, 2][S.q]);

// ---------- renderer / cameras ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
let pr = maxPR; renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(), head = new THREE.Object3D(); scene.add(head);
const cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 50000);
const eyeL = new THREE.PerspectiveCamera(S.fov, 1, 0.1, 50000), eyeR = eyeL.clone(); head.add(cam, eyeL, eyeR);
head.position.set(0, 1.6, 4);

const loader = new THREE.TextureLoader(), aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const tex = (f, srgb = true, rep = 1) => { const t = loader.load('textures/' + f); t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep > 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t; };
const SUN = new THREE.Vector3(0.5, 0.5, 0.75).normalize();

// ---------- space: nebula sky + stars ----------
const sky = new THREE.Mesh(new THREE.SphereGeometry(20000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `varying vec3 vD;
    float h(vec3 p){ p=fract(p*0.3183+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float n(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
    float fbm(vec3 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.07; a*=0.5; } return s; }
    void main(){
      vec3 d=normalize(vD);
      float band=exp(-pow(dot(d,normalize(vec3(0.3,0.8,-0.5)))*2.2,2.0));      // a milky-way style band
      float f=fbm(d*3.0+fbm(d*6.0)*0.8), g=fbm(d*5.0+7.0);
      vec3 neb=mix(vec3(0.35,0.08,0.45),vec3(0.05,0.35,0.6),g)*pow(f,2.5)*1.6 + vec3(0.9,0.35,0.25)*pow(fbm(d*9.0+3.0),5.0)*band*2.0;
      gl_FragColor=vec4(neb*(0.25+band),1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` }));
sky.renderOrder = -10; scene.add(sky);
{ const n = [2500, 5000, 8000][S.q], p = new Float32Array(n * 3), c = new Float32Array(n * 3), v = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < n; i++) { v.randomDirection().multiplyScalar(15000); p.set([v.x, v.y, v.z], i * 3);
    col.setHSL(0.55 + Math.random() * 0.15 - (Math.random() < 0.2 ? 0.5 : 0), 0.4, 0.5 + Math.random() ** 4 * 0.5); c.set([col.r, col.g, col.b], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false })); stars.renderOrder = -9; scene.add(stars); }

// ---------- Earth (day map, ocean glints from specular map, clouds, atmosphere glow) ----------
const earth = new THREE.Group(); earth.position.set(-2600, -4300, -5200); earth.rotation.z = 0.41; scene.add(earth);
const R = 5000;
const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), new THREE.MeshPhongMaterial({
  map: tex('earth_atmos_2048.jpg'), specularMap: tex('earth_specular_2048.jpg', false), normalMap: tex('earth_normal_2048.jpg', false),
  normalScale: new THREE.Vector2(0.8, 0.8), specular: 0x335577, shininess: 25 }));
const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.008, 96, 48), new THREE.MeshLambertMaterial({ map: tex('earth_clouds_1024.png'), transparent: true, opacity: 0.85, depthWrite: false }));
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 96, 48), new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { sun: { value: SUN } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vV=normalize(w.xyz-cameraPosition); gl_Position=projectionMatrix*viewMatrix*w; }',
  fragmentShader: 'uniform vec3 sun; varying vec3 vN; varying vec3 vV; void main(){ float r=pow(clamp(1.0-abs(dot(vN,vV))*1.15,0.0,1.0),3.0); float lit=clamp(dot(-vN,sun)*0.8+0.4,0.0,1.0); gl_FragColor=vec4(vec3(0.3,0.6,1.0)*r*lit*2.5,1.0); }' }));
earth.add(globe, clouds, atmo);
const sunLight = new THREE.DirectionalLight(0xfff4e8, 3.2); sunLight.position.copy(SUN); scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x223355, 0.35));
const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff6e0, blending: THREE.AdditiveBlending, depthWrite: false, map: (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, '#fff'); g.addColorStop(0.08, '#fff'); g.addColorStop(0.25, 'rgba(255,230,190,0.35)'); g.addColorStop(1, 'rgba(255,200,150,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })() }));
sunDisc.scale.setScalar(2500); sunDisc.position.copy(SUN).multiplyScalar(14000); scene.add(sunDisc);

// ---------- the lounge: metal deck, glass dome with ribs, light strips, seats ----------
const DOME = 9;
const metal = new THREE.MeshStandardMaterial({ map: tex('metal_diff.jpg', true, 6), normalMap: tex('metal_nor_gl.jpg', false, 6), roughnessMap: tex('metal_rough.jpg', false, 6), metalness: 0.85, roughness: 0.6, color: 0x9aa3ad });
const deck = new THREE.Mesh(new THREE.CircleGeometry(DOME, 64).rotateX(-Math.PI / 2), metal); scene.add(deck);
const rim = new THREE.Mesh(new THREE.CylinderGeometry(DOME + 0.3, DOME + 0.3, 0.6, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide }));
rim.position.y = 0.3; scene.add(rim);
const glass = new THREE.Mesh(new THREE.SphereGeometry(DOME, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
  color: 0x9fc4ff, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
glass.position.y = 0.6; scene.add(glass);
const ribMat = new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 0.9, roughness: 0.3 });
for (let i = 0; i < 8; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(DOME, 0.07, 8, 64, Math.PI), ribMat); rib.rotation.y = i * Math.PI / 8; rib.position.y = 0.6; scene.add(rib); }
for (const h of [0.6, 4.5]) { const r = Math.sqrt(DOME * DOME - (h - 0.6) ** 2); const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.08, 8, 96), ribMat); ring.rotation.x = Math.PI / 2; ring.position.y = h; scene.add(ring); }
const strip = new THREE.Mesh(new THREE.TorusGeometry(DOME - 0.15, 0.03, 6, 128), new THREE.MeshBasicMaterial({ color: 0x66ccff })); strip.rotation.x = Math.PI / 2; strip.position.y = 0.02; scene.add(strip);
const seatMat = new THREE.MeshStandardMaterial({ color: 0xe8e6e1, roughness: 0.55 });
for (const i of [0, 1, 4, 5]) {          // reclined lounge seats around the centre, angled toward the screen
  const a = -Math.PI / 2 + (i - 2.5) * 0.45, seat = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.2, 6, 16).rotateZ(Math.PI / 2), seatMat); base.position.y = 0.45;
  const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 6, 16), seatMat); back.position.set(0.75, 0.85, 0); back.rotation.z = -0.9;
  seat.add(base, back); seat.position.set(Math.cos(a) * 3.5, 0, Math.sin(a) * 3.5 + 3); seat.rotation.y = -a + Math.PI; scene.add(seat);
}
const pl = new THREE.PointLight(0x88bbff, 6, 14); pl.position.set(0, 6, 0); scene.add(pl);

// ---------- the movie screen, floating overhead outside the dome ----------
const SW = 40;
const placeholder = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 576; const x = c.getContext('2d');
  x.fillStyle = '#0a1830'; x.fillRect(0, 0, 1024, 576); x.fillStyle = '#cfe6ff'; x.font = '600 56px sans-serif'; x.textAlign = 'center';
  x.fillText('ORBITAL LOUNGE', 512, 250); x.font = '32px sans-serif'; x.fillText('Load a movie from the menu', 512, 320);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const screenMat = new THREE.MeshBasicMaterial({ map: placeholder, transparent: true, opacity: 0.93, toneMapped: false, side: THREE.DoubleSide });
const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SW * 9 / 16), screenMat);
screen.position.set(0, 26, -30); screen.lookAt(0, 1.6, 2); scene.add(screen);
const frame = new THREE.Mesh(new THREE.PlaneGeometry(SW + 1, SW * 9 / 16 + 1), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
frame.position.copy(screen.position); frame.quaternion.copy(screen.quaternion); frame.translateZ(-0.2); scene.add(frame);
const video = Object.assign(document.createElement('video'), { playsInline: true, loop: true, crossOrigin: 'anonymous' });
video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
$('videoFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  video.src = URL.createObjectURL(f);
  video.onloadedmetadata = () => {
    const vt = new THREE.VideoTexture(video); vt.colorSpace = THREE.SRGBColorSpace;
    screenMat.map = vt; screenMat.needsUpdate = true; screen.scale.y = (video.videoHeight / video.videoWidth) / (9 / 16);
    $('status').textContent = '🎬 ' + f.name + ' loaded. It starts when you press Play.';
  };
};
const togglePlay = () => { if (!video.src) return toast('Load a movie from the menu first.'); video.paused ? video.play().catch(() => {}) : video.pause(); };

// ---------- state, menu ----------
const gyro = new Gyro(), audio = new Ambience(S.muted);
let mode = 'menu', yaw = 0, pitch = 0.25, yawOffset = 0, needCenter = true, walk = false, drag = null, tapAt = 0, holdT = 0;
const qG = new THREE.Quaternion(), qY = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), eu = new THREE.Euler(), v3 = new THREE.Vector3();
const yawOf = q => eu.setFromQuaternion(q, 'YXZ').y;
function toast(m, ms = 5000) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), ms); }
async function start(vr) {
  const perm = gyro.request(); audio.start();
  if (video.src) video.play().catch(() => {});
  try { navigator.wakeLock?.request('screen')?.catch(() => {}); } catch (e) {}
  mode = vr ? 'vr' : 'play'; document.body.className = mode;
  $('menu').hidden = $('settings').hidden = true; $('hud').hidden = false; needCenter = true; resize();
  toast(vr ? 'Look up at the screen. Tap: play/pause. Hold: walk. Two-finger tap: face the screen.' : 'Look up at the screen. Drag or move the phone to look. ⏯ plays/pauses.');
  if (!(await perm) && mobile) toast('Motion access not granted, so drag to look. See README.', 7000);
}
function toMenu() { mode = 'menu'; document.body.className = ''; walk = false; $('hud').hidden = true; $('menu').hidden = false; resize(); }
const setMuted = m => { S.muted = m; save(); audio.setMuted(m); video.muted = m; $('mute').textContent = m ? '🔇' : '🔊'; $('setMute').checked = m; };
$('play').onclick = () => start(false); $('vr').onclick = () => start(true); $('exit').onclick = toMenu;
$('mute').onclick = () => setMuted(!S.muted); $('playBtn').onclick = togglePlay;
$('openSettings').onclick = () => { $('menu').hidden = true; $('settings').hidden = false; };
$('back').onclick = () => { $('settings').hidden = true; $('menu').hidden = false; };
$('setMute').checked = S.muted; $('setMute').onchange = e => setMuted(e.target.checked); $('mute').textContent = S.muted ? '🔇' : '🔊';
$('setQ').value = S.q; $('qVal').textContent = QN[S.q]; $('setQ').onchange = e => { S.q = +e.target.value; save(); location.reload(); };
for (const [id, k, u] of [['setIpd', 'ipd', ' mm'], ['setFov', 'fov', '°']]) { const el = $(id); el.value = S[k]; $(id + 'Val').textContent = S[k] + u;
  el.oninput = () => { S[k] = +el.value; $(id + 'Val').textContent = el.value + u; save(); }; }
document.querySelectorAll('#menu button').forEach(b => b.disabled = false);

// ---------- input ----------
const cv = renderer.domElement;
const look = (dx, dy) => { if (gyro.active) yawOffset += dx * 0.005; else { yaw += dx * 0.005; pitch = Math.max(-1.4, Math.min(1.4, pitch + dy * 0.005)); } };
const faceScreen = () => { const t = Math.atan2(head.position.x - screen.position.x, head.position.z - screen.position.z); if (gyro.read(qG)) yawOffset = t - yawOf(qG); else { yaw = t; pitch = 0.5; } };
cv.addEventListener('touchstart', e => { e.preventDefault(); if (mode === 'menu') return;
  if (e.touches.length >= 2) { clearTimeout(holdT); tapAt = 0; walk = false; drag = null; faceScreen(); return; }
  if (mode === 'vr') { tapAt = performance.now(); holdT = setTimeout(() => { walk = true; tapAt = 0; }, 300); }
  else drag = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: false });
cv.addEventListener('touchmove', e => { e.preventDefault(); if (!drag) return; const t = e.touches[0]; look(t.clientX - drag.x, t.clientY - drag.y); drag = { x: t.clientX, y: t.clientY }; }, { passive: false });
cv.addEventListener('touchend', e => { if (e.touches.length) return; clearTimeout(holdT); if (tapAt) togglePlay(); tapAt = 0; walk = false; drag = null; });
cv.addEventListener('mousedown', e => { if (mode !== 'menu') drag = { x: e.clientX, y: e.clientY }; });
addEventListener('mousemove', e => { if (drag) { look(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; } });
addEventListener('mouseup', () => drag = null);
for (const [ev, on] of [['touchstart', 1], ['touchend', 0], ['mousedown', 1], ['mouseup', 0], ['mouseleave', 0]])
  $('walk').addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); walk = !!on; }, { passive: false });
const keys = {};
addEventListener('keydown', e => { keys[e.code] = 1; if (e.code === 'Space') togglePlay(); if (e.code === 'Escape') toMenu(); if (e.code === 'KeyM') setMuted(!S.muted); });
addEventListener('keyup', e => keys[e.code] = 0);
function resize() { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 300));

// ---------- loop ----------
let last = performance.now(), acc = 0, cnt = 0;
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (mode === 'menu') head.quaternion.setFromEuler(eu.set(0.25 + Math.sin(now / 9000) * 0.1, (yaw += dt * 0.04), 0, 'YXZ'));
  else if (gyro.read(qG)) { if (needCenter) { yawOffset = yaw - yawOf(qG); needCenter = false; } head.quaternion.copy(qY.setFromAxisAngle(Y, yawOffset)).multiply(qG); }
  else head.quaternion.setFromEuler(eu.set(pitch, yaw, 0, 'YXZ'));
  const f = (walk ? 1 : 0) + (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  if (f && mode !== 'menu') {
    v3.set(0, 0, -1).applyQuaternion(head.quaternion); v3.y = 0; v3.normalize().multiplyScalar(f * 2 * dt);
    head.position.add(v3); const r = Math.hypot(head.position.x, head.position.z);
    if (r > DOME - 1) { head.position.x *= (DOME - 1) / r; head.position.z *= (DOME - 1) / r; }
  }
  earth.rotation.y += dt * 0.004; clouds.rotation.y += dt * 0.0015;   // slow orbit drift
  audio.update(dt);
  if (mode === 'vr') {
    const w = innerWidth / 2, h = innerHeight; renderer.setScissorTest(true);
    for (const [c, s, x] of [[eyeL, -1, 0], [eyeR, 1, w]]) { c.position.x = s * S.ipd / 2000; c.fov = S.fov; c.aspect = w / h; c.updateProjectionMatrix();
      renderer.setViewport(x, 0, w, h); renderer.setScissor(x, 0, w, h); renderer.render(scene, c); }
    renderer.setScissorTest(false);
  } else { renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.render(scene, cam); }
  acc += dt; cnt++;
  if (acc > 2) { const a = acc / cnt; if (a > 1 / 40 && pr > 0.6) renderer.setPixelRatio(pr *= 0.85); else if (a < 1 / 55 && pr < maxPR) renderer.setPixelRatio(pr = Math.min(maxPR, pr * 1.08)); acc = cnt = 0; }
});
if (location.hash === '#play' || location.hash === '#vr') start(location.hash === '#vr');   // testing shortcut

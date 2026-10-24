# Orbital Lounge VR

A glass-domed lounge orbiting Earth, with a huge see-through movie screen floating overhead. It's a separate project from vr-mountains and vr-fishing, and the three share no files.

## Run it
- **PC:** run `npx http-server -p 8080 -c-1` in this folder, then open http://localhost:8080
- **iPhone:** needs **https** for motion sensors. Upload `index.html`, `js/`, `lib/` and `textures/` to a new GitHub repo, then turn on **Settings → Pages → main / root**. Open the link in Safari, then use **Share → Add to Home Screen**.

## Controls
- **Play:** move the phone, or drag, to look. Hold **Hold to walk** to move. ⏯ plays and pauses.
- **VR:** turn your head to look. Tap to play or pause, hold to walk, two-finger tap to face the screen.
- **PC:** drag to look, W/S to walk, Space to play/pause, M to mute, Esc for the menu.

## Movies
Tap **Load movie (MP4)** in the menu and pick a video from Files. It stays on your phone and nothing is uploaded. H.264 MP4 at 720p plays best. Free, legal films include the Blender open movies (studio.blender.org) and public-domain films on archive.org. Never upload movies to the public repo.

## iPhone permissions
- **Motion & Orientation:** tap **Allow** when it asks after you press Play or VR Mode. If you tapped Don't Allow, close the tab and reopen it, or clear Safari's website data.
- **Sound:** the ambience and movie sound only start after a tap. The silent switch mutes them.

## Credits
- three.js r160 (MIT).
- Earth textures from the three.js examples (MIT; based on NASA imagery).
- `metal_plate` texture from Poly Haven (CC0).
- The nebula, stars and sounds are generated in code.

## Limits
It's a phone browser, so the dome glass is a simple tinted, reflective surface rather than true refraction, and the seats are simple shapes. There's no water here, since you're in space. Earth's oceans show sun glints instead.

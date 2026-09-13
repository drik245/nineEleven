/* app.js — Consumer Vending Machine Dashboard
   Three.js 3D vending machine + Firebase realtime + UPI payment flow */

// ── State ─────────────────────────────────────────────────────────────────
let db = null;
let currentCandy = null;  // candy being purchased
let stockData = {};        // live stock from Firebase
let orderRef = null;       // ref to current order being tracked

const STORAGE_KEY = 'vending_firebase_url';
const CANDY_COLORS = [0xff7eb3, 0xa78bfa, 0x6ee7b7];  // pink, purple, mint
const CANDY_IMAGES = ['../images/candy_a.png', '../images/candy_b.png', '../images/candy_c.png'];

// ── Firebase Connection ───────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        document.getElementById('firebaseUrlInput').value = saved;
        connectFirebase();
    }
    initThreeScene();
});

window.connectFirebase = function() {
    const urlInput = document.getElementById('firebaseUrlInput');
    let url = urlInput.value.trim().replace(/\/+$/, '');
    if (!url) return;
    if (!url.startsWith('https://')) url = 'https://' + url;

    const match = url.match(/https:\/\/(.+?)\.firebaseio\.com/);
    if (!match) { showToast('Invalid Firebase URL'); return; }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp({ databaseURL: url });
        }
        db = firebase.database();
        localStorage.setItem(STORAGE_KEY, url);

        document.getElementById('configBanner').classList.add('hidden');
        document.getElementById('mainContent').style.display = '';

        listenStock();
        listenStatus();
        showToast('🍬 Connected!');
    } catch (e) {
        showToast('Connection failed: ' + e.message);
    }
};

// ── Firebase Listeners ────────────────────────────────────────────────────

function listenStock() {
    db.ref('vending_machine/stock').on('value', snap => {
        const data = snap.val();
        if (!data) return;
        stockData = data;
        renderCandyCards(data);
        updateVendingMachine(data);
    });
}

function listenStatus() {
    db.ref('vending_machine/status').on('value', snap => {
        const data = snap.val();
        if (!data) return;
        const pill = document.getElementById('statusPill');
        const text = document.getElementById('statusText');
        const now = Date.now() / 1000;
        const isOnline = data.online && (now - (data.last_seen || 0) < 120);

        if (isOnline) {
            pill.classList.remove('offline');
            text.textContent = 'Machine Online';
        } else {
            pill.classList.add('offline');
            text.textContent = 'Machine Offline';
        }
    });
}

// ── Candy Cards Rendering ─────────────────────────────────────────────────

function renderCandyCards(data) {
    const container = document.getElementById('candyList');
    container.innerHTML = '';

    const entries = Object.entries(data);
    entries.forEach(([key, item], i) => {
        const qty = item.qty || 0;
        const soldOut = qty <= 0;
        let level = 'high';
        if (qty <= 2) level = 'low';
        else if (qty <= 5) level = 'mid';

        const card = document.createElement('div');
        card.className = `candy-card ${soldOut ? 'sold-out' : ''}`;
        card.innerHTML = `
            <img class="candy-img" src="${CANDY_IMAGES[i] || CANDY_IMAGES[0]}"
                 alt="${item.name || key}">
            <div class="candy-info">
                <div class="candy-name">${item.name || key}</div>
                <div class="candy-price">₹${item.price || 0}</div>
                <span class="candy-stock ${level}">
                    ${soldOut ? '❌ Sold out' : `✓ ${qty} left`}
                </span>
            </div>
            <div class="candy-actions">
                <button class="btn-buy" onclick="openPayModal('${key}', ${i})"
                        ${soldOut ? 'disabled' : ''}>
                    Buy Now
                </button>
                <div class="sold-out-badge">Sold Out</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ── Three.js Vending Machine ──────────────────────────────────────────────

let scene, camera, renderer, vendingGroup;
let candyMeshes = [];

function initThreeScene() {
    const container = document.getElementById('vendingScene');
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0e6ff);

    // Camera
    camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0.5, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(3, 5, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0xff7eb3, 0.4, 10);
    pointLight.position.set(-2, 2, 3);
    scene.add(pointLight);

    // Vending machine group
    vendingGroup = new THREE.Group();
    scene.add(vendingGroup);

    buildVendingMachine();
    animate();

    // Resize handler
    window.addEventListener('resize', () => {
        const w2 = container.clientWidth;
        const h2 = container.clientHeight;
        camera.aspect = w2 / h2;
        camera.updateProjectionMatrix();
        renderer.setSize(w2, h2);
    });
}

function buildVendingMachine() {
    // ── Main body (rounded box effect) ───────────────────────────────
    const bodyGeo = new THREE.BoxGeometry(2.2, 3, 1.2);
    const bodyMat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        specular: 0x444444,
        shininess: 60,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0;
    body.castShadow = true;
    body.receiveShadow = true;
    vendingGroup.add(body);

    // ── Glass front ──────────────────────────────────────────────────
    const glassGeo = new THREE.PlaneGeometry(1.8, 2.4);
    const glassMat = new THREE.MeshPhongMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.25,
        specular: 0xffffff,
        shininess: 100,
        side: THREE.DoubleSide,
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 0.1, 0.61);
    vendingGroup.add(glass);

    // ── Glass border/frame ───────────────────────────────────────────
    const frameMat = new THREE.MeshPhongMaterial({ color: 0xff7eb3 });

    // Top frame
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.1), frameMat);
    topFrame.position.set(0, 1.34, 0.61);
    vendingGroup.add(topFrame);

    // Bottom frame
    const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.1), frameMat);
    bottomFrame.position.set(0, -1.06, 0.61);
    vendingGroup.add(bottomFrame);

    // Left frame
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.48, 0.1), frameMat);
    leftFrame.position.set(-0.96, 0.14, 0.61);
    vendingGroup.add(leftFrame);

    // Right frame
    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.48, 0.1), frameMat);
    rightFrame.position.set(0.96, 0.14, 0.61);
    vendingGroup.add(rightFrame);

    // ── Shelves ──────────────────────────────────────────────────────
    const shelfMat = new THREE.MeshPhongMaterial({ color: 0xfce4ec });

    for (let i = 0; i < 3; i++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.8), shelfMat);
        shelf.position.set(0, 0.9 - i * 0.8, 0.15);
        shelf.receiveShadow = true;
        vendingGroup.add(shelf);
    }

    // ── Candy items on shelves (colored spheres) ─────────────────────
    const loader = new THREE.TextureLoader();
    candyMeshes = [];

    for (let i = 0; i < 3; i++) {
        const candyGeo = new THREE.SphereGeometry(0.22, 32, 32);
        const candyMat = new THREE.MeshPhongMaterial({
            color: CANDY_COLORS[i],
            specular: 0xffffff,
            shininess: 80,
        });
        const candy = new THREE.Mesh(candyGeo, candyMat);
        candy.position.set(0, 1.15 - i * 0.8, 0.15);
        candy.castShadow = true;
        vendingGroup.add(candy);
        candyMeshes.push(candy);

        // Wrapper detail — a torus ring around each
        const wrapperGeo = new THREE.TorusGeometry(0.22, 0.03, 8, 24);
        const wrapperMat = new THREE.MeshPhongMaterial({
            color: CANDY_COLORS[(i + 1) % 3],
            specular: 0xffffff,
            shininess: 60,
        });
        const wrapper = new THREE.Mesh(wrapperGeo, wrapperMat);
        wrapper.position.copy(candy.position);
        wrapper.rotation.x = Math.PI / 2;
        vendingGroup.add(wrapper);
    }

    // ── Dispense slot at bottom ──────────────────────────────────────
    const slotGeo = new THREE.BoxGeometry(1.4, 0.35, 0.15);
    const slotMat = new THREE.MeshPhongMaterial({ color: 0x1f1f1f });
    const slot = new THREE.Mesh(slotGeo, slotMat);
    slot.position.set(0, -1.25, 0.55);
    vendingGroup.add(slot);

    // ── Title on top ─────────────────────────────────────────────────
    const topGeo = new THREE.BoxGeometry(2.2, 0.3, 1.2);
    const topMat = new THREE.MeshPhongMaterial({
        color: 0xff7eb3,
        specular: 0xffffff,
        shininess: 40,
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 1.65;
    vendingGroup.add(top);

    vendingGroup.position.y = -0.3;
}

function updateVendingMachine(data) {
    // Update candy mesh visibility based on stock
    const entries = Object.values(data);
    for (let i = 0; i < Math.min(entries.length, candyMeshes.length); i++) {
        const qty = entries[i].qty || 0;
        candyMeshes[i].visible = qty > 0;
    }
}

function animate() {
    requestAnimationFrame(animate);
    const t = Date.now() * 0.001;

    // Gentle sway
    if (vendingGroup) {
        vendingGroup.rotation.y = Math.sin(t * 0.5) * 0.08;
    }

    // Candy float
    candyMeshes.forEach((mesh, i) => {
        if (mesh.visible) {
            mesh.position.y = (1.15 - i * 0.8) + Math.sin(t * 1.5 + i * 1.2) * 0.03;
            mesh.rotation.y = t * 0.8 + i;
        }
    });

    renderer.render(scene, camera);
}

// ── Payment Flow ──────────────────────────────────────────────────────────

window.openPayModal = function(key, index) {
    const item = stockData[key];
    if (!item || item.qty <= 0) return;

    currentCandy = { key, index, name: item.name, price: item.price };

    document.getElementById('payCandyName').textContent = item.name;
    document.getElementById('payAmount').textContent = '₹' + item.price;

    // Generate QR code
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = '';
    const upiString = `upi://pay?pa=vendor@upi&pn=SweetMachine&am=${item.price}&cu=INR&tn=${item.name}`;
    const qr = qrcode(0, 'M');
    qr.addData(upiString);
    qr.make();
    const qrImg = document.createElement('img');
    qrImg.src = qr.createDataURL(6, 0);
    qrImg.style.borderRadius = '8px';
    qrImg.style.cursor = 'pointer';
    qrImg.onclick = () => showConfirmation();
    qrContainer.appendChild(qrImg);

    document.getElementById('payOverlay').classList.add('active');
};

window.closePayModal = function() {
    document.getElementById('payOverlay').classList.remove('active');
    currentCandy = null;
};

window.showConfirmation = function() {
    if (!currentCandy) return;
    document.getElementById('payOverlay').classList.remove('active');

    document.getElementById('confirmDetails').textContent = 'Pay for ' + currentCandy.name;
    document.getElementById('confirmAmount').textContent = '₹' + currentCandy.price;
    document.getElementById('btnConfirmPay').disabled = false;
    document.getElementById('btnConfirmPay').textContent = '✓ Confirm & Pay';

    document.getElementById('confirmOverlay').classList.add('active');
};

window.closeConfirmModal = function() {
    document.getElementById('confirmOverlay').classList.remove('active');
};

window.processPayment = function() {
    if (!currentCandy || !db) return;

    const btn = document.getElementById('btnConfirmPay');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    // Write pending order to Firebase
    const orderData = {
        candy_index: currentCandy.index,
        candy_name: currentCandy.name,
        price: currentCandy.price,
        status: 'pending',
        timestamp: Date.now() / 1000,
    };

    const newOrderRef = db.ref('vending_machine/orders').push();
    const orderId = newOrderRef.key;

    newOrderRef.set(orderData).then(() => {
        // Close confirm modal
        document.getElementById('confirmOverlay').classList.remove('active');

        // Show success
        document.getElementById('successMsg').textContent =
            `${currentCandy.name} is being dispensed from the machine! 🍬`;
        document.getElementById('successOverlay').classList.add('active');

        // Listen for order completion
        db.ref(`vending_machine/orders/${orderId}/status`).on('value', snap => {
            const status = snap.val();
            if (status === 'completed') {
                document.getElementById('successMsg').textContent =
                    '✅ Your candy has been dispensed! Enjoy!';
                db.ref(`vending_machine/orders/${orderId}/status`).off();
            } else if (status === 'failed') {
                document.getElementById('successMsg').textContent =
                    '❌ Sorry, this candy is out of stock.';
                db.ref(`vending_machine/orders/${orderId}/status`).off();
            }
        });

        currentCandy = null;
    }).catch(err => {
        btn.disabled = false;
        btn.textContent = '✓ Confirm & Pay';
        showToast('Payment failed: ' + err.message);
    });
};

window.closeSuccessModal = function() {
    document.getElementById('successOverlay').classList.remove('active');
};

// ── Toast ─────────────────────────────────────────────────────────────────

function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
}

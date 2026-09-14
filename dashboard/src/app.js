/* app.js — NineEleven Cute Candy Vending Machine */

// ── State ──
var state = {
    db: null,
    stockData: {},
    selectedCandy: null,
    isOnline: false
};

var FIREBASE_URL = 'https://vending-6bced-default-rtdb.firebaseio.com';
var EMOJIS = ['🍭', '🍫', '🍬', '🍩', '🍪', '🧁'];
var AVATAR_COLORS = ['pink', 'purple', 'mint', 'peach', 'blue', 'coral'];
var CANDY_COLORS_3D = [0xff6b9d, 0xc084fc, 0x34d399, 0xfbbf24, 0x60a5fa, 0xfb7185];

// ── Boot ──
window.addEventListener('DOMContentLoaded', function() {
    spawnParticles();
    spawnCandyRain();
    document.getElementById('firebaseUrlInput').value = FIREBASE_URL;
    initThreeScene();
});

// ── Floating Background Particles ──
function spawnParticles() {
    var container = document.getElementById('particles');
    if (!container) return;
    var candies = ['🍬', '🍭', '🍫', '🍩', '⭐', '✨', '💖'];
    for (var i = 0; i < 15; i++) {
        var p = document.createElement('div');
        p.className = 'particle';
        p.textContent = candies[Math.floor(Math.random() * candies.length)];
        p.style.left = (Math.random() * 100) + '%';
        p.style.animationDuration = (12 + Math.random() * 18) + 's';
        p.style.animationDelay = (Math.random() * 15) + 's';
        p.style.fontSize = (1 + Math.random() * 1.5) + 'rem';
        container.appendChild(p);
    }
}

// ── Candy Rain on Connect Screen ──
function spawnCandyRain() {
    var container = document.getElementById('candyRain');
    if (!container) return;
    var sweets = ['🍬', '🍭', '🍫', '🍩', '🧁', '🍪', '🍰'];
    for (var i = 0; i < 20; i++) {
        var drop = document.createElement('div');
        drop.className = 'rain-drop';
        drop.textContent = sweets[Math.floor(Math.random() * sweets.length)];
        drop.style.left = (Math.random() * 100) + '%';
        drop.style.animationDuration = (5 + Math.random() * 8) + 's';
        drop.style.animationDelay = (Math.random() * 6) + 's';
        drop.style.fontSize = (1.2 + Math.random() * 1.5) + 'rem';
        container.appendChild(drop);
    }
}

// ── Firebase ──
window.connectFirebase = function() {
    var urlInput = document.getElementById('firebaseUrlInput');
    var url = urlInput.value.trim().replace(/\/+$/, '');
    if (!url) {
        showToast('Enter a Firebase URL first!', 'error');
        return;
    }
    if (url.indexOf('https://') !== 0) url = 'https://' + url;

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp({ databaseURL: url });
        }
        state.db = firebase.database();

        // Transition from connect screen to dashboard
        document.getElementById('connectScreen').style.display = 'none';
        var dash = document.getElementById('dashboard');
        dash.style.display = '';

        seedInitialData();
        listenStock();
        listenStatus();

        showToast('Connected! Let the sweetness begin! 🍬', 'success');
        setTimeout(function() { window.dispatchEvent(new Event('resize')); }, 150);

    } catch (e) {
        showToast('Connection failed: ' + e.message, 'error');
    }
};

function seedInitialData() {
    if (!state.db) return;
    state.db.ref('vending_machine/stock').once('value', function(snap) {
        if (!snap.exists() || !snap.val()) {
            var initialStock = {
                candy_a: { name: 'Fruit Drops',   price: 10, qty: 8 },
                candy_b: { name: 'Choco Delight', price: 20, qty: 5 },
                candy_c: { name: 'Mint Blast',    price: 15, qty: 10 }
            };
            state.db.ref('vending_machine/stock').set(initialStock);
        }
    });
    state.db.ref('vending_machine/status').once('value', function(snap) {
        if (!snap.exists() || !snap.val()) {
            state.db.ref('vending_machine/status').set({
                online: true,
                last_seen: Math.floor(Date.now() / 1000)
            });
        }
    });
}

function listenStock() {
    state.db.ref('vending_machine/stock').on('value', function(snap) {
        var data = snap.val();
        if (!data) return;
        state.stockData = data;
        renderCandyCards(data);
        updateThreeSceneStock(data);
    });
}

function listenStatus() {
    state.db.ref('vending_machine/status').on('value', function(snap) {
        var data = snap.val();
        if (!data) return;
        var pill = document.getElementById('statusPill');
        var text = document.getElementById('statusText');
        var now = Date.now() / 1000;
        state.isOnline = data.online && (now - (data.last_seen || 0) < 120);
        if (state.isOnline) {
            pill.className = 'status-chip';
            text.textContent = 'Machine Online';
        } else {
            pill.className = 'status-chip offline';
            text.textContent = 'Machine Offline';
        }
    });
}

// ── Candy Cards ──
function renderCandyCards(data) {
    var container = document.getElementById('candyList');
    container.innerHTML = '';

    var entries = Object.entries(data);
    entries.forEach(function(entry, i) {
        var key = entry[0];
        var item = entry[1];
        var qty = item.qty || 0;
        var soldOut = qty <= 0;
        var emoji = EMOJIS[i % EMOJIS.length];
        var colorClass = AVATAR_COLORS[i % AVATAR_COLORS.length];

        var stockLevel = 'high';
        if (qty <= 2) stockLevel = 'low';
        else if (qty <= 5) stockLevel = 'mid';

        var card = document.createElement('div');
        card.className = 'candy-card' + (soldOut ? ' sold-out' : '');

        if (!soldOut) {
            (function(k, idx) {
                card.onclick = function() { openPayModal(k, idx); };
            })(key, i);
        }

        var stockText = soldOut ? '❌ Sold out' : '✓ ' + qty + ' left';
        var arrowText = soldOut ? '—' : '→';

        card.innerHTML = '<div class="candy-avatar ' + colorClass + '">' + emoji + '</div>' +
            '<div class="candy-details">' +
                '<div class="name">' + (item.name || key) + '</div>' +
                '<div class="price">₹' + (item.price || 0) + '</div>' +
                '<div class="stock-pill ' + stockLevel + '">' + stockText + '</div>' +
            '</div>' +
            '<div class="card-arrow">' + arrowText + '</div>';

        container.appendChild(card);
    });
}

// ── Three.js 3D Machine ──
var scene, camera, renderer, machineGroup;
var candyMeshes = [];

function initThreeScene() {
    var container = document.getElementById('vendingScene');
    if (!container) return;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfce7f3);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    var dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(3, 6, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    var pinkLight = new THREE.PointLight(0xff6b9d, 0.6, 10);
    pinkLight.position.set(-3, 2, 3);
    scene.add(pinkLight);

    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.5, 6);

    machineGroup = new THREE.Group();
    scene.add(machineGroup);

    buildCuteMachine();

    var resizeObserver = new ResizeObserver(function(entries) {
        for (var j = 0; j < entries.length; j++) {
            var rect = entries[j].contentRect;
            if (rect.width > 0 && rect.height > 0) {
                renderer.setSize(rect.width, rect.height);
                camera.aspect = rect.width / rect.height;
                camera.updateProjectionMatrix();
            }
        }
    });
    resizeObserver.observe(container);

    var clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        var t = clock.getElapsedTime();

        if (machineGroup) {
            machineGroup.rotation.y = Math.sin(t * 0.4) * 0.12;
        }

        for (var i = 0; i < candyMeshes.length; i++) {
            var cm = candyMeshes[i];
            if (cm.mesh.visible) {
                cm.mesh.position.y = cm.baseY + Math.sin(t * 2.5 + i * 1.3) * 0.04;
                cm.mesh.rotation.y += 0.025;
                cm.mesh.rotation.z = Math.sin(t + i) * 0.1;
            }
        }

        renderer.render(scene, camera);
    }
    animate();
}

function buildCuteMachine() {
    // Cute rounded-look body (white/pink)
    var bodyGeo = new THREE.BoxGeometry(2.2, 3.2, 1.2);
    var bodyMat = new THREE.MeshPhongMaterial({
        color: 0xfff0f5,
        specular: 0xffffff,
        shininess: 40
    });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    machineGroup.add(body);

    // Pink header
    var headerGeo = new THREE.BoxGeometry(2.2, 0.35, 1.2);
    var headerMat = new THREE.MeshPhongMaterial({ color: 0xff6b9d, specular: 0xffffff, shininess: 50 });
    var header = new THREE.Mesh(headerGeo, headerMat);
    header.position.y = 1.75;
    machineGroup.add(header);

    // Glass panel
    var glassGeo = new THREE.PlaneGeometry(1.8, 2.4);
    var glassMat = new THREE.MeshPhongMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.2,
        specular: 0xffffff,
        shininess: 100,
        side: THREE.DoubleSide
    });
    var glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 0.1, 0.61);
    machineGroup.add(glass);

    // Pink frame edges
    var frameMat = new THREE.MeshPhongMaterial({ color: 0xff6b9d });
    var tf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.08), frameMat);
    tf.position.set(0, 1.34, 0.61); machineGroup.add(tf);
    var bf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.08), frameMat);
    bf.position.set(0, -1.10, 0.61); machineGroup.add(bf);
    var lf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.50, 0.08), frameMat);
    lf.position.set(-0.97, 0.12, 0.61); machineGroup.add(lf);
    var rf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.50, 0.08), frameMat);
    rf.position.set(0.97, 0.12, 0.61); machineGroup.add(rf);

    // Shelves
    var shelfMat = new THREE.MeshPhongMaterial({ color: 0xfce7f3 });
    candyMeshes = [];

    for (var row = 0; row < 3; row++) {
        var shelf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.8), shelfMat);
        var sy = 1.0 - row * 0.7;
        shelf.position.set(0, sy, 0.2);
        shelf.receiveShadow = true;
        machineGroup.add(shelf);

        // Candy on each shelf
        var candyGeo = new THREE.SphereGeometry(0.18, 24, 24);
        var color = CANDY_COLORS_3D[row % CANDY_COLORS_3D.length];
        var candyMat = new THREE.MeshPhongMaterial({
            color: color,
            specular: 0xffffff,
            shininess: 80
        });
        var candy = new THREE.Mesh(candyGeo, candyMat);
        var baseY = sy + 0.22;
        candy.position.set(0, baseY, 0.2);
        candy.castShadow = true;
        machineGroup.add(candy);

        // Wrapper ring
        var wrapGeo = new THREE.TorusGeometry(0.18, 0.03, 8, 24);
        var wrapColor = CANDY_COLORS_3D[(row + 1) % CANDY_COLORS_3D.length];
        var wrapMat = new THREE.MeshPhongMaterial({ color: wrapColor, specular: 0xffffff, shininess: 60 });
        var wrap = new THREE.Mesh(wrapGeo, wrapMat);
        wrap.position.copy(candy.position);
        wrap.rotation.x = Math.PI / 2;
        machineGroup.add(wrap);

        candyMeshes.push({ mesh: candy, baseY: baseY });
    }

    // Dispense slot
    var slotGeo = new THREE.BoxGeometry(1.2, 0.3, 0.12);
    var slotMat = new THREE.MeshPhongMaterial({ color: 0x2d1b33 });
    var slot = new THREE.Mesh(slotGeo, slotMat);
    slot.position.set(0, -1.3, 0.58);
    machineGroup.add(slot);

    machineGroup.position.y = -0.2;
}

function updateThreeSceneStock(data) {
    var entries = Object.values(data);
    for (var i = 0; i < candyMeshes.length; i++) {
        if (i < entries.length) {
            candyMeshes[i].mesh.visible = (entries[i].qty || 0) > 0;
        } else {
            candyMeshes[i].mesh.visible = false;
        }
    }
}

// ── Payment Flow (new QR every time) ──
window.openPayModal = function(key, index) {
    if (!state.isOnline) {
        showToast('Machine is offline right now 😢', 'error');
        return;
    }
    var item = state.stockData[key];
    if (!item || item.qty <= 0) return;

    state.selectedCandy = { key: key, index: index, name: item.name, price: item.price };

    document.getElementById('payCandyIcon').textContent = EMOJIS[index % EMOJIS.length];
    document.getElementById('payCandyName').textContent = item.name;
    document.getElementById('payAmount').textContent = '₹' + item.price;

    // Generate a UNIQUE QR code each time with a timestamp nonce
    var nonce = Date.now();
    var upiString = 'upi://pay?pa=vendor@upi&pn=NineEleven&am=' + item.price +
                    '&cu=INR&tn=' + encodeURIComponent(item.name) +
                    '&tr=NE' + nonce;

    var qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = '';
    try {
        var qr = qrcode(0, 'M');
        qr.addData(upiString);
        qr.make();
        var img = document.createElement('img');
        img.src = qr.createDataURL(6, 0);
        qrContainer.appendChild(img);
    } catch(e) {
        console.error('QR Error', e);
    }

    document.getElementById('payOverlay').classList.add('active');
};

window.closePayModal = function() {
    document.getElementById('payOverlay').classList.remove('active');
    state.selectedCandy = null;
};

window.showConfirmation = function() {
    if (!state.selectedCandy) return;
    document.getElementById('payOverlay').classList.remove('active');
    document.getElementById('confirmDetails').textContent = state.selectedCandy.name;
    document.getElementById('confirmAmount').textContent = '₹' + state.selectedCandy.price;
    var btn = document.getElementById('btnConfirmPay');
    btn.disabled = false;
    btn.textContent = '✓ Yes, Pay!';
    document.getElementById('confirmOverlay').classList.add('active');
};

window.closeConfirmModal = function() {
    document.getElementById('confirmOverlay').classList.remove('active');
};

window.processPayment = function() {
    if (!state.selectedCandy || !state.db) return;
    var btn = document.getElementById('btnConfirmPay');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    var orderData = {
        candy_index: state.selectedCandy.index,
        candy_name: state.selectedCandy.name,
        price: state.selectedCandy.price,
        status: 'pending',
        timestamp: Math.floor(Date.now() / 1000)
    };

    var newOrderRef = state.db.ref('vending_machine/orders').push();
    var orderId = newOrderRef.key;

    newOrderRef.set(orderData).then(function() {
        document.getElementById('confirmOverlay').classList.remove('active');

        document.getElementById('successEmoji').textContent = '🎉';
        document.getElementById('successMsg').textContent = 'Dispensing your ' + state.selectedCandy.name + '...';
        document.getElementById('successLoader').style.display = 'block';
        document.getElementById('btnSuccessDone').style.display = 'none';
        document.getElementById('successOverlay').classList.add('active');

        // Fire confetti
        spawnConfetti();

        var orderStatusRef = state.db.ref('vending_machine/orders/' + orderId + '/status');
        orderStatusRef.on('value', function(snap) {
            var s = snap.val();
            if (s === 'completed') {
                document.getElementById('successEmoji').textContent = '🍬';
                document.getElementById('successMsg').textContent = 'Enjoy your treat! 🎉';
                document.getElementById('successLoader').style.display = 'none';
                document.getElementById('btnSuccessDone').style.display = 'inline-block';
                orderStatusRef.off();
            } else if (s === 'failed') {
                document.getElementById('successEmoji').textContent = '😢';
                document.getElementById('successMsg').textContent = 'Oops! Something went wrong.';
                document.getElementById('successLoader').style.display = 'none';
                document.getElementById('btnSuccessDone').style.display = 'inline-block';
                orderStatusRef.off();
            }
        });

        state.selectedCandy = null;
    }).catch(function(err) {
        btn.disabled = false;
        btn.textContent = '✓ Yes, Pay!';
        showToast('Payment failed: ' + err.message, 'error');
    });
};

window.closeSuccessModal = function() {
    document.getElementById('successOverlay').classList.remove('active');
    // Clear confetti
    var burst = document.getElementById('confettiBurst');
    if (burst) burst.innerHTML = '';
};

// ── Confetti Burst ──
function spawnConfetti() {
    var container = document.getElementById('confettiBurst');
    if (!container) return;
    container.innerHTML = '';
    var colors = ['#ff6b9d', '#c084fc', '#34d399', '#fbbf24', '#60a5fa', '#fb7185'];
    for (var i = 0; i < 40; i++) {
        var piece = document.createElement('div');
        piece.className = 'confetti';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        var angle = (Math.random() * 360) * (Math.PI / 180);
        var dist = 80 + Math.random() * 160;
        piece.style.setProperty('--x', (Math.cos(angle) * dist) + 'px');
        piece.style.setProperty('--y', (Math.sin(angle) * dist) + 'px');
        piece.style.animationDelay = (Math.random() * 0.3) + 's';
        piece.style.width = (6 + Math.random() * 6) + 'px';
        piece.style.height = (6 + Math.random() * 6) + 'px';
        container.appendChild(piece);
    }
}

// ── Toast ──
function showToast(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast';

    var icon = '🍬';
    if (type === 'error') icon = '😢';
    if (type === 'success') icon = '✨';

    toast.innerHTML = '<span>' + icon + '</span> <span>' + msg + '</span>';
    container.appendChild(toast);

    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 400);
    }, 3500);
}

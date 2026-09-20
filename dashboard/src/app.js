/* app.js - NineEleven Happi Loop–Inspired Landing Page */

// ── State ──
var state = {
    db: null,
    stockData: {},
    selectedCandy: null,
    isOnline: false
};

var FIREBASE_URL = 'https://vending-6bced-default-rtdb.firebaseio.com';
var EMOJIS = ['🍭', '🍫', '🍬', '🍩', '🍪', '🧁'];
var CARD_COLORS = ['purple', 'blue', 'orange', 'lime', 'pink', 'coral'];
var CARD_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
var CANDY_COLORS_3D = [0xff6b9d, 0xc084fc, 0x34d399, 0xfbbf24, 0x60a5fa, 0xfb7185];

// ── Boot ──
window.addEventListener('DOMContentLoaded', function() {
    spawnParticles();
    initThreeScene();
    initNavbar();
    initScrollReveal();

    // Auto-connect to Firebase
    try {
        firebase.initializeApp({ databaseURL: FIREBASE_URL });
        state.db = firebase.database();

        seedInitialData();
        listenStock();
        listenStatus();
    } catch (e) {
        console.error('Firebase init failed:', e);
        // Render fallback cards even without Firebase
        renderFallbackCards();
    }
});

// ── Floating Background Particles ──
function spawnParticles() {
    var container = document.getElementById('particles');
    if (!container) return;
    var candies = ['🍬', '🍭', '🍫', '🍩', '⭐', '✨', '💖'];
    for (var i = 0; i < 12; i++) {
        var p = document.createElement('div');
        p.className = 'particle';
        p.textContent = candies[Math.floor(Math.random() * candies.length)];
        p.style.left = (Math.random() * 100) + '%';
        p.style.animationDuration = (14 + Math.random() * 20) + 's';
        p.style.animationDelay = (Math.random() * 15) + 's';
        p.style.fontSize = (1 + Math.random() * 1.5) + 'rem';
        container.appendChild(p);
    }
}

// ── Navbar Scroll Effect ──
function initNavbar() {
    var navbar = document.getElementById('navbar');
    var hamburger = document.getElementById('navHamburger');
    var navLinks = document.getElementById('navLinks');

    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Hamburger toggle
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            navLinks.classList.toggle('open');
        });

        // Close nav on link click
        var links = navLinks.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
            links[i].addEventListener('click', function() {
                navLinks.classList.remove('open');
            });
        }
    }
}

// ── Scroll Reveal ──
function initScrollReveal() {
    var revealElements = document.querySelectorAll('.about-cloud, .products-header, .product-grid, .feature-card, .cta-inner, .about-stats, .about-images');

    revealElements.forEach(function(el) {
        el.classList.add('reveal');
    });

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    revealElements.forEach(function(el) {
        observer.observe(el);
    });
}


// ── Firebase Data ──
function seedInitialData() {
    if (!state.db) return;
    state.db.ref('vending_machine/stock').once('value', function(snap) {
        if (!snap.exists() || !snap.val()) {
            var initialStock = {
                candy_a: { name: 'Kaccha Mango',  price: 5,  qty: 10 },
                candy_b: { name: 'Melody',        price: 10, qty: 10 },
                candy_c: { name: 'Center Fresh',  price: 15, qty: 10 }
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
        var now = Date.now() / 1000;
        state.isOnline = data.online && (now - (data.last_seen || 0) < 120);
    });
}


// ── Candy Cards — Happi Loop Style ──
function renderCandyCards(data) {
    var container = document.getElementById('candyList');
    if (!container) return;
    container.innerHTML = '';

    var entries = Object.entries(data);
    entries.forEach(function(entry, i) {
        var key = entry[0];
        var item = entry[1];
        var qty = item.qty || 0;
        var soldOut = qty <= 0;
        var emoji = EMOJIS[i % EMOJIS.length];
        var colorClass = CARD_COLORS[i % CARD_COLORS.length];
        var letter = CARD_LETTERS[i % CARD_LETTERS.length];

        var stockLevel = 'high';
        if (qty <= 2) stockLevel = 'low';
        else if (qty <= 5) stockLevel = 'mid';

        var card = document.createElement('div');
        card.className = 'candy-card' + (soldOut ? ' sold-out' : '');
        card.setAttribute('data-color', colorClass);

        if (!soldOut) {
            (function(k, idx) {
                card.onclick = function() { openPayModal(k, idx); };
            })(key, i);
        }

        var stockText = soldOut ? '❌ Sold out' : '✓ ' + qty + ' left';

        card.innerHTML =
            '<div class="candy-letter">' +
                '<span>' + letter + '</span>' +
                '<span class="candy-emoji">' + emoji + '</span>' +
            '</div>' +
            '<div class="candy-details">' +
                '<div class="name">' + (item.name || key) + '</div>' +
                '<div class="price">₹' + (item.price || 0) + '</div>' +
                '<div class="stock-pill ' + stockLevel + '">' + stockText + '</div>' +
            '</div>' +
            '<button class="card-cart" aria-label="Add to cart">🛒</button>';

        container.appendChild(card);
    });
}

function renderFallbackCards() {
    var fallback = {
        candy_a: { name: 'Kaccha Mango',  price: 5,  qty: 10 },
        candy_b: { name: 'Melody',        price: 10, qty: 10 },
        candy_c: { name: 'Center Fresh',  price: 15, qty: 10 },
        candy_d: { name: 'Choco Blast',   price: 20, qty: 8 }
    };
    renderCandyCards(fallback);
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
    renderer.setClearColor(0x000000, 0); // transparent background
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    // No opaque background — let the CSS gradient show through

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    var dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(3, 6, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    var purpleLight = new THREE.PointLight(0xc084fc, 0.5, 10);
    purpleLight.position.set(-3, 2, 3);
    scene.add(purpleLight);

    var yellowLight = new THREE.PointLight(0xfbbf24, 0.3, 10);
    yellowLight.position.set(3, -1, 4);
    scene.add(yellowLight);

    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.3, 5.5);

    machineGroup = new THREE.Group();
    scene.add(machineGroup);

    buildCuteMachine();

    // Clone scene into features section viewport
    cloneToFeaturesViewport();

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

function cloneToFeaturesViewport() {
    var container2 = document.getElementById('vendingScene2');
    if (!container2 || !renderer) return;

    // Create a second renderer for the features section
    var renderer2 = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer2.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer2.shadowMap.enabled = true;
    renderer2.setClearColor(0x000000, 0);
    container2.appendChild(renderer2.domElement);

    var camera2 = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera2.position.set(0, 0.3, 5.5);

    var resizeObserver2 = new ResizeObserver(function(entries) {
        for (var j = 0; j < entries.length; j++) {
            var rect = entries[j].contentRect;
            if (rect.width > 0 && rect.height > 0) {
                renderer2.setSize(rect.width, rect.height);
                camera2.aspect = rect.width / rect.height;
                camera2.updateProjectionMatrix();
            }
        }
    });
    resizeObserver2.observe(container2);

    // Render loop for second viewport
    function animate2() {
        requestAnimationFrame(animate2);
        renderer2.render(scene, camera2);
    }
    animate2();
}

function buildCuteMachine() {
    // ── Open-front body: back + sides + top/bottom (NO front face) ──
    var wallMat = new THREE.MeshPhongMaterial({
        color: 0x2d1b6e, specular: 0xffffff, shininess: 40,
        side: THREE.DoubleSide
    });

    // Back wall
    var back = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), wallMat);
    back.position.set(0, 0, -0.6);
    back.receiveShadow = true;
    machineGroup.add(back);

    // Left wall
    var leftW = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.2), wallMat);
    leftW.position.set(-1.1, 0, 0);
    leftW.rotation.y = Math.PI / 2;
    machineGroup.add(leftW);

    // Right wall
    var rightW = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.2), wallMat);
    rightW.position.set(1.1, 0, 0);
    rightW.rotation.y = -Math.PI / 2;
    machineGroup.add(rightW);

    // Top cap
    var topW = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2), wallMat);
    topW.position.set(0, 1.6, 0);
    topW.rotation.x = Math.PI / 2;
    machineGroup.add(topW);

    // Bottom cap
    var bottomW = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2), wallMat);
    bottomW.position.set(0, -1.6, 0);
    bottomW.rotation.x = -Math.PI / 2;
    machineGroup.add(bottomW);

    // Yellow header (brand strip)
    var headerGeo = new THREE.BoxGeometry(2.2, 0.35, 1.2);
    var headerMat = new THREE.MeshPhongMaterial({ color: 0xfbbf24, specular: 0xffffff, shininess: 50 });
    var header = new THREE.Mesh(headerGeo, headerMat);
    header.position.y = 1.75;
    machineGroup.add(header);

    // Glass panel
    var glassGeo = new THREE.PlaneGeometry(1.8, 2.4);
    var glassMat = new THREE.MeshPhongMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.12,
        specular: 0xffffff,
        shininess: 100,
        side: THREE.DoubleSide
    });
    var glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 0.1, 0.61);
    machineGroup.add(glass);

    // Frame edges (deep purple)
    var frameMat = new THREE.MeshPhongMaterial({ color: 0x6c3fc5 });
    var tf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.08), frameMat);
    tf.position.set(0, 1.34, 0.61); machineGroup.add(tf);
    var bf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.08), frameMat);
    bf.position.set(0, -1.10, 0.61); machineGroup.add(bf);
    var lf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.50, 0.08), frameMat);
    lf.position.set(-0.97, 0.12, 0.61); machineGroup.add(lf);
    var rf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.50, 0.08), frameMat);
    rf.position.set(0.97, 0.12, 0.61); machineGroup.add(rf);

    // Shelves
    var shelfMat = new THREE.MeshPhongMaterial({ color: 0x3b2d7e });
    candyMeshes = [];

    for (var row = 0; row < 3; row++) {
        var shelf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.8), shelfMat);
        var sy = 1.0 - row * 0.75;
        shelf.position.set(0, sy, 0.2);
        shelf.receiveShadow = true;
        machineGroup.add(shelf);

        // Main candy sphere
        var color = CANDY_COLORS_3D[row % CANDY_COLORS_3D.length];
        var candyGeo = new THREE.SphereGeometry(0.24, 32, 32);
        var candyMat = new THREE.MeshPhongMaterial({
            color: color,
            specular: 0xffffff,
            shininess: 100,
            emissive: color,
            emissiveIntensity: 0.15
        });
        var candy = new THREE.Mesh(candyGeo, candyMat);
        var baseY = sy + 0.28;
        candy.position.set(0, baseY, 0.25);
        candy.castShadow = true;
        machineGroup.add(candy);

        // Wrapper ring
        var wrapGeo = new THREE.TorusGeometry(0.24, 0.04, 12, 32);
        var wrapColor = CANDY_COLORS_3D[(row + 1) % CANDY_COLORS_3D.length];
        var wrapMat = new THREE.MeshPhongMaterial({ color: wrapColor, specular: 0xffffff, shininess: 80 });
        var wrap = new THREE.Mesh(wrapGeo, wrapMat);
        wrap.position.copy(candy.position);
        wrap.rotation.x = Math.PI / 2;
        machineGroup.add(wrap);

        // Two smaller companion candies
        var sideColors = [CANDY_COLORS_3D[(row + 2) % CANDY_COLORS_3D.length], CANDY_COLORS_3D[(row + 3) % CANDY_COLORS_3D.length]];
        var sideOffsets = [-0.45, 0.45];
        for (var s = 0; s < 2; s++) {
            var sGeo = new THREE.SphereGeometry(0.15, 24, 24);
            var sMat = new THREE.MeshPhongMaterial({
                color: sideColors[s],
                specular: 0xffffff,
                shininess: 80,
                emissive: sideColors[s],
                emissiveIntensity: 0.1
            });
            var sMesh = new THREE.Mesh(sGeo, sMat);
            sMesh.position.set(sideOffsets[s], sy + 0.19, 0.25);
            sMesh.castShadow = true;
            machineGroup.add(sMesh);
        }

        candyMeshes.push({ mesh: candy, baseY: baseY });
    }

    // Dispense slot
    var slotGeo = new THREE.BoxGeometry(1.2, 0.3, 0.12);
    var slotMat = new THREE.MeshPhongMaterial({ color: 0x110b30 });
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

// ── Payment Flow (preserved from original) ──
window.openPayModal = function(key, index) {
    if (!state.isOnline) {
        showToast('Machine is offline - order will be queued!', 'info');
    }
    var item = state.stockData[key];
    if (!item || item.qty <= 0) return;

    state.selectedCandy = { key: key, index: index, name: item.name, price: item.price };

    document.getElementById('payCandyIcon').textContent = EMOJIS[index % EMOJIS.length];
    document.getElementById('payCandyName').textContent = item.name;
    document.getElementById('payAmount').textContent = '₹' + item.price;

    // Generate unique QR code
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
        var orderResolved = false;

        orderStatusRef.on('value', function(snap) {
            var s = snap.val();
            if (s === 'completed') {
                orderResolved = true;
                document.getElementById('successEmoji').textContent = '🍬';
                document.getElementById('successMsg').textContent = 'Enjoy your treat! 🎉';
                document.getElementById('successLoader').style.display = 'none';
                document.getElementById('btnSuccessDone').style.display = 'inline-block';
                orderStatusRef.off();
            } else if (s === 'failed') {
                orderResolved = true;
                document.getElementById('successEmoji').textContent = '😢';
                document.getElementById('successMsg').textContent = 'Oops! Something went wrong.';
                document.getElementById('successLoader').style.display = 'none';
                document.getElementById('btnSuccessDone').style.display = 'inline-block';
                orderStatusRef.off();
            }
        });

        // Timeout: if machine doesn't respond within 8s, let user dismiss
        setTimeout(function() {
            if (!orderResolved) {
                document.getElementById('successEmoji').textContent = '📦';
                document.getElementById('successMsg').textContent = 'Order queued! Machine will dispense when it\u0027s back online.';
                document.getElementById('successLoader').style.display = 'none';
                document.getElementById('btnSuccessDone').style.display = 'inline-block';
                orderStatusRef.off();
            }
        }, 8000);

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

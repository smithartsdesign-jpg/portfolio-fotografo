import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// === COLE O SEU FIREBASE CONFIG AQUI TAMBÉM ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCRAqIwiuer6yP6fu63_8ZC8E098jJv6n8",
  authDomain: "portfolio-fotografo.firebaseapp.com",
  projectId: "portfolio-fotografo",
  storageBucket: "portfolio-fotografo.firebasestorage.app",
  messagingSenderId: "1057756685221",
  appId: "1:1057756685221:web:3a81cfd0862b3792e5be4c",
  measurementId: "G-CVSFDJ478V"
};

let db;
if (firebaseConfig.apiKey !== "COLE_AQUI") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
}
// ==============================================



// Variavel global para o grupo da câmera principal
let mainCameraGroup = null;

// ==========================================
// 1. SETUP DA CENA THREE.JS
// ==========================================
const canvas = document.querySelector('#webgl-canvas');
const scene = new THREE.Scene();
// Background transparente para mostrar a cor da página
scene.background = null; 
scene.fog = new THREE.FogExp2(0x050505, 0.002); // Adiciona neblina de profundidade

// Câmera da cena Three.js
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};
const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 1000);
// Posição inicial da câmera (olhando para a câmera 3D de longe)
camera.position.set(0, 0, 150); 
scene.add(camera);

// Renderizador
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Adicionando um ambiente de reflexão hiper-realista
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

// ==========================================
// 2. LUZES CINEMATOGRÁFICAS (TEAL & ORANGE)
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // Bem suave para manter contraste
scene.add(ambientLight);

// Luz Principal Direcional (Refletor Principal do Estádio)
const directionalLight = new THREE.DirectionalLight(0xffffff, 8); // Muito forte, branca brilhante
directionalLight.position.set(20, 100, 50); // Vem bem de cima
scene.add(directionalLight);

// Luz de Rebatimento (Grama do Estádio iluminando por baixo)
const grassBounceLight = new THREE.PointLight(0x00ff66, 6000, 300);
grassBounceLight.position.set(-40, -50, -50); // Vem de baixo
scene.add(grassBounceLight);

// Refletor Secundário (Luz Fria/Azulada)
const stadiumLight = new THREE.PointLight(0xcceeff, 5000, 400);
stadiumLight.position.set(60, 80, 20);
scene.add(stadiumLight);

// ==========================================
// 2.5 PARTICULAS DE POEIRA CINEMATOGRÁFICA
// ==========================================
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 800; // Quantidade de poeira flutuante
const posArray = new Float32Array(particlesCount * 3);

for(let i = 0; i < particlesCount * 3; i++) {
    // Espalhar num volume gigantesco
    posArray[i] = (Math.random() - 0.5) * 400;
}
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.6,
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending // Faz as partículas brilharem mais
});
const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// ==========================================
// 3. CARREGAMENTO DO MODELO 3D
// ==========================================
let cameraModel = null;
const cameraGroup = new THREE.Group(); // Grupo para controlar a animação separada do modelo
scene.add(cameraGroup);

//Paths for the assets
const objPath = 'assets/3d objetos/Camara Analogica.obj';

const objLoader = new OBJLoader();

// Materiais Procedurais (Leves e sem texturas pesadas)
const blackMetalMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a, // Preto profundo
    metalness: 0.9,  // Muito metálico
    roughness: 0.2,  // Levemente escovado
    clearcoat: 0.8,  // Brilho do verniz
    clearcoatRoughness: 0.1,
    envMapIntensity: 2.0,
    side: THREE.DoubleSide // Corrige normais invertidas (buracos/transparência)
});

const silverMetalMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc0c0c0, // Prata
    metalness: 1.0,  // 100% metálico
    roughness: 0.15, // Cromo/Prata polida
    clearcoat: 1.0,  // Brilho intenso
    clearcoatRoughness: 0.05,
    envMapIntensity: 2.5,
    side: THREE.DoubleSide // Corrige normais invertidas (buracos/transparência)
});

// Material especial ultra-realista para o vidro da Lente
const lensGlassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x050505, // Fundo ultra escuro (quase preto)
    metalness: 1.0, // Força a refletir o ambiente como um espelho escuro
    roughness: 0.0, // Perfeitamente liso
    clearcoat: 1.0, // Brilho vitrificado
    clearcoatRoughness: 0.0,
    envMapIntensity: 5.0, // Reflexo muito forte do estúdio
    iridescence: 1.0, // Dá aquele efeito furta-cor roxo/esverdeado de lentes profissionais!
    iridescenceIOR: 1.5,
    iridescenceThicknessRange: [100, 400],
    side: THREE.DoubleSide
});

objLoader.load(objPath, (object) => {
    cameraModel = object;
    
    // Aplicar os materiais às partes separadas do modelo
    cameraModel.traverse((child) => {
        if (child.isMesh) {
            if (child.name.includes('Lens') || child.name.includes('Lente')) {
                child.material = lensGlassMaterial; // Vidro da lente com reflexo colorido
            } else if (child.name.includes('Accesorio') || child.name.includes('Accesorios')) {
                child.material = silverMetalMaterial; // Anéis e botões em prata
            } else {
                child.material = blackMetalMaterial; // Corpo preto metálico
            }
        }
    });
    
    // Ajustes iniciais do modelo
    // Normalizar a escala porque modelos diferentes tem tamanhos base diferentes
    cameraModel.scale.set(1, 1, 1);
    const box = new THREE.Box3().setFromObject(cameraModel);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // O modelo antigo tinha cerca de 140 unidades e scale de 0.5 (Tamanho final ~70)
    const targetSize = 70;
    const scale = targetSize / maxDim;
    cameraModel.scale.setScalar(scale);
    
    // Centralizar a geometria em seu próprio eixo APÓS escalar
    box.setFromObject(cameraModel);
    const center = box.getCenter(new THREE.Vector3());
    cameraModel.position.x = -center.x;
    cameraModel.position.y = -center.y;
    cameraModel.position.z = -center.z;
    // CORREÇÃO DA POSIÇÃO INICIAL DO MODELO
    // A Camara Analogica tem um sistema de eixos diferente, x=0 mantém ela horizontal
    cameraModel.rotation.x = 0; 
    cameraModel.rotation.y = 0; // Lente virada para frente (0 graus no eixo Y aponta para +Z)
    
    // 4. CÂMERA PRINCIPAL E CÂMERA SECUNDÁRIA
    const group1 = new THREE.Group(); 
    group1.add(cameraModel);
    scene.add(group1);
    
    const group2 = new THREE.Group(); // Câmera que vai passar na horizontal
    const cameraModel2 = cameraModel.clone();
    group2.add(cameraModel2);
    scene.add(group2);
    
    // Posição Inicial Câmera Principal: Escondida, começando no fundo a direita
    group1.position.set(20, -15, -150); 
    group1.rotation.set(Math.PI / 6, -Math.PI / 4, Math.PI / 8);
    group1.scale.set(0, 0, 0); // VEM DO ZERO INICIALMENTE

    // Posição Inicial Câmera Secundária: Fora da tela à direita, alta e ao fundo
    group2.position.set(150, 30, -80);
    group2.rotation.set(Math.PI / 4, -Math.PI / 2, 0);
    group2.scale.set(0.2, 0.2, 0.2); // Começa em 20%

    // Adicionando luzes próprias à câmera principal para simular Tela e Lente acesas
    const lensLight = new THREE.PointLight(0xffffff, 50, 100);
    lensLight.position.set(0, 0, 20); // Frente da câmera (Lente)
    group1.add(lensLight);

    const screenLight = new THREE.PointLight(0x00ff66, 100, 150); // Tela brilha em verde
    screenLight.position.set(0, 0, -20); // Trás da câmera
    group1.add(screenLight);

    // Iniciar animações de Scroll após carregar
    setupScrollAnimations(group1, group2, particlesMesh);
    
    // Revelar o título com animação
    document.querySelector('.hero').classList.add('loaded');
    
}, undefined, (error) => {
    console.error('Erro ao carregar o OBJ', error);
});

// ==========================================
// 4. ANIMAÇÕES GSAP E SCROLLTRIGGER
// ==========================================
gsap.registerPlugin(ScrollTrigger);

function setupScrollAnimations(g1, g2, particles) {

    // Guardar a referência global para o Post-Processing calcular a distância
    mainCameraGroup = g1;

    // ANIMAÇÃO INICIAL DO HERO TEXT (Ao carregar a página)
    gsap.from('.hero-title', { y: 50, opacity: 0, duration: 1.5, ease: "power3.out", delay: 0.2 });
    gsap.from('.hero-subtitle', { y: 20, opacity: 0, duration: 1.5, ease: "power3.out", delay: 0.6 });

    // TIMELINE 1: CÂMERA 3D (Inicia direto no topo da tela)
    const tl3D = gsap.timeline({
        scrollTrigger: {
            trigger: '.hero', // Começa AGORA, no instante que o usuário rola 1px
            start: 'top top',
            endTrigger: '.portfolio', // A câmera continua vindo até a galeria entrar
            end: 'top 30%', // O movimento da câmera só para no exato momento do flash (ajustado para top 30%)
            scrub: 0.2, // Reduzido de 1 para 0.2: resposta MUITO mais rápida e direta ao movimento do mouse
        }
    });

    const isMobile = window.innerWidth < 768;
    const g1Scale = isMobile ? 0.7 : 1.2;
    const g2Scale = isMobile ? 0.5 : 0.9;

    // Animação complexa da câmera principal rodando e se aproximando
    // "ease: none" garante que ela comece a rodar no milissegundo em que o scroll inicia
    tl3D.to(g1.scale, { x: g1Scale, y: g1Scale, z: g1Scale, ease: "none" }, 0); // Fica bem maior na frente da tela (ou ajustada no mobile)
    tl3D.to(g1.position, { z: 125, y: -15, x: 35, ease: "none" }, 0); // Z: 125, move para a DIREITA (x:35) e para BAIXO (y:-15) para emoldurar o texto
    tl3D.to(g1.rotation, { x: 0.25, y: Math.PI * 2 - 0.15, z: 0.0, ease: "none" }, 0); // Inclinada para cima (x:0.25) para a LENTE brilhar e pegar o reflexo

    // Câmera Secundária cruzando a tela horizontalmente no fundo (20% a 70% scale)
    // Presa no eixo Z:-80 para não colidir com a Câmera 1 e afundar suavemente na neblina (Fog)
    tl3D.to(g2.position, { x: -45, z: 80, y: 25, ease: "none" }, 0); // Move para a ESQUERDA (x:-45) e para CIMA (y:25) cruzando a cena
    tl3D.to(g2.scale, { x: g2Scale, y: g2Scale, z: g2Scale, ease: "none" }, 0); // Escala levemente menor que a principal
    tl3D.to(g2.rotation, { x: Math.PI * 2 + 0.4, y: Math.PI * 2 + 0.4, z: Math.PI * 2 - 0.2, ease: "none" }, 0); // Tumblando 360º no ar (rotação completa em todos os eixos)

    // Efeito das partículas voando no sentido da câmera
    tl3D.to(particles.position, { z: 150, ease: "none" }, 0);

    // Efeito Parallax no background do estádio (zoom in sutil e deslocamento para baixo)
    tl3D.to('#parallax-bg', { scale: 1.15, y: 100, ease: "none" }, 0);

    // Hero Text desfocando e subindo rápido (Parallax inicial)
    tl3D.to('.hero-subtitle', { opacity: 0, duration: 0.2, ease: "none" }, 0); // O subtítulo some super rápido
    tl3D.to('.hero-title', { y: -150, filter: "blur(10px)", duration: 0.25, ease: "none" }, 0); // O título inteiro sobe e borra na mesma velocidade que acende

    // Efeito do texto ACENDENDO (preenchendo de baixo pra cima apenas no animating-text) 
    tl3D.to('.depth-title, .green-text', { backgroundPosition: "0% 100%", duration: 0.25, ease: "none" }, 0);
    // "da lente" preenche quase que instantaneamente no início do scroll
    tl3D.to('.animating-text', { backgroundPosition: "0% 100%", duration: 0.1, ease: "none" }, 0);
    
    // Efeito de GLOW ligando nos textos (separados para que a green-text não fique borrada)
    tl3D.to('.green-text', { filter: "drop-shadow(0px 0px 30px rgba(0, 255, 102, 0.9))", duration: 0.25, ease: "none" }, 0);
    tl3D.to('.animating-text', { filter: "drop-shadow(0px 0px 25px rgba(0, 255, 102, 0.8))", duration: 0.1, ease: "none" }, 0);

    // FOTO PART2: O cara no canto saindo da cena
    // Desliza levemente para a esquerda e para cima sem sumir e sem borrar muito
    tl3D.fromTo('.photographer-part2',
        { x: "0%", y: "0%", scaleX: 1, scaleY: 1, filter: "blur(0px)", opacity: 0.95 },
        { x: "-5%", y: "5%", scaleX: 1.02, scaleY: 1.02, filter: "blur(2px)", opacity: 0.95, ease: "none" },
    0);

    // TIMELINE 2: REVELAÇÃO DO PORTFOLIO (Transição Contínua e Bonita)


    const tlPortfolio = gsap.timeline({
        paused: true, // Começa pausada, será controlada pelos callbacks
        scrollTrigger: {
            trigger: '.portfolio',
            start: 'top 30%', // Sincronizado perfeitamente com o final do tl3D, evita buraco branco
            onEnter: () => tlPortfolio.timeScale(1).play(),
            onLeaveBack: () => tlPortfolio.timeScale(4).reverse() // Rebobina 4x mais rápido para o flash sumir logo!
        }
    });

    // 1. O FLASH CONTÍNUO E FLUIDO
    // Cresce um brilho forte e imediato com blur para efeito cinematográfico
    tlPortfolio.to('#flash', { opacity: 1, duration: 0.15, ease: "power2.in" });
    tlPortfolio.to('#flash', { filter: "blur(0px)", duration: 0.1 }, "<");
    
    // NO PICO DO FLASH (Tela 100% branca):
    // Desaparece o Canvas 3D e o fundo escuro, mudando TUDO para o tema claro
    tlPortfolio.set(renderer.domElement, { opacity: 0 });
    tlPortfolio.set('#parallax-bg', { opacity: 0 }); // Esconde o background do estádio
    tlPortfolio.set('.transition-spacer', { opacity: 0 }); // Esconde o texto verde grande para não conflitar com o fundo branco
    tlPortfolio.set('body', { backgroundColor: '#f4f4f5' });
    tlPortfolio.to('.portfolio', { filter: "blur(0px)", opacity: 1, duration: 0.01 }, "<"); 
    
    // O Flash se dissipa lentamente e revela a nova cena, ficando borrado novamente
    tlPortfolio.to('#flash', { opacity: 0, filter: "blur(20px)", duration: 0.8, ease: "power2.out" });

    // 2. ROLAGEM HORIZONTAL E APARECIMENTO DAS POLAROIDS VIA FIREBASE
    const galleryGrid = document.querySelector('.gallery-grid');

    async function carregarPortfolio() {
        if (!db) {
            console.error("Firebase não configurado. Galeria não será carregada.");
            return;
        }

        try {
            // Usa o novo campo 'order' para exibir na ordem que o usuário definiu no painel
            const q = query(collection(db, "portfolio"), orderBy("order", "asc"));
            const querySnapshot = await getDocs(q);
            
            // Criar e injetar as fotos no HTML
            querySnapshot.forEach((doc) => {
                const item = doc.data();
                const div = document.createElement('div');
                div.className = 'gallery-item';
                div.style.backgroundImage = `url('${item.image}')`;
                div.innerHTML = `
                    <div class="gallery-overlay">
                        <h3>${item.title}</h3>
                        <span>Ver ensaio</span>
                    </div>
                `;
                galleryGrid.appendChild(div);
            });

            const galleryItemsArray = gsap.utils.toArray('.gallery-item');
            
            // Corrige o cálculo de rolagem se houver poucas fotos (não rola se couber na tela)
            const getScrollAmount = () => {
                let amount = galleryGrid.scrollWidth - window.innerWidth + (window.innerWidth * 0.1);
                return amount > 0 ? -amount : 0;
            };

            // Calcula a distância do scroll horizontal
            const scrollDistance = Math.max(galleryGrid.scrollWidth, window.innerWidth);

            // Ajusta o .about para subir sobre a galeria no final do pino
            gsap.set('.about', { marginTop: -window.innerHeight });

            const horizontalTween = gsap.to(galleryGrid, {
                x: getScrollAmount,
                ease: "none"
            });

            // 1. O PINO (Dura o scroll horizontal + 1 tela inteira para o sobrepor)
            ScrollTrigger.create({
                trigger: '.portfolio',
                start: 'top top',
                end: () => `+=${scrollDistance + window.innerHeight}`, 
                pin: true,
                pinSpacing: true, 
                invalidateOnRefresh: true 
            });

            // 2. A ANIMAÇÃO HORIZONTAL (Dura apenas o scroll horizontal)
            ScrollTrigger.create({
                trigger: '.portfolio',
                start: 'top top',
                end: () => `+=${scrollDistance}`, 
                animation: horizontalTween,
                scrub: 1, 
                invalidateOnRefresh: true 
            });

            // Anima as fotos para aparecerem assim que a galeria é revelada
            galleryItemsArray.forEach((item, i) => {
                gsap.set(item, { 
                    y: 800, 
                    z: -1000, 
                    rotationZ: Math.random() * 60 - 30, 
                    rotationY: Math.random() * 60 - 30,
                    rotationX: Math.random() * 60 - 30,
                    opacity: 0,
                    scale: 0.5
                });

                gsap.to(item, {
                    y: 0,
                    z: Math.random() * 150, 
                    rotationZ: Math.random() * 10 - 5, 
                    rotationY: Math.random() * 10 - 5, 
                    rotationX: 0, 
                    opacity: 1, 
                    scale: 1,
                    ease: "back.out(1.2)",
                    duration: 1.5,
                    delay: i * 0.1, // Efeito cascata lindo
                    scrollTrigger: {
                        trigger: '.portfolio',
                        start: "top 30%", 
                        toggleActions: "play none none reverse"
                    }
                });
            });

            // EFEITO DE MOUSEMOVE PARALLAX NOS POLAROIDS (SENSACIONAL)
            document.addEventListener('mousemove', (e) => {
                const x = (e.clientX / window.innerWidth - 0.5) * 20; 
                const y = (e.clientY / window.innerHeight - 0.5) * 20;
                
                galleryItemsArray.forEach(item => {
                    if (gsap.getProperty(item, "opacity") > 0.8) {
                        gsap.to(item, {
                            rotationY: x,
                            rotationX: -y,
                            transformPerspective: 900,
                            ease: "power1.out",
                            duration: 0.5
                        });
                    }
                });
            });

        } catch (error) {
            console.error("Erro ao carregar do Firebase:", error);
        }
    }
    
    // Executa a função e atualiza o GSAP após finalizar
    carregarPortfolio().then(() => {
        ScrollTrigger.refresh();
    });

    // Parallax da foto do About no scroll (A imagem se move dentro do contêiner)
    gsap.to('.about-image img', {
        yPercent: 15,
        ease: "none",
        scrollTrigger: {
            trigger: '.about',
            start: "top bottom",
            end: "bottom top",
            scrub: true
        }
    });

    // ANIMAÇÕES DA SEÇÃO ABOUT (FOTO E TEXTOS SEPARADOS)
    // Animação de entrada do About (Ramp up)
    gsap.fromTo('.about-image, .about-text h2, .about-text p', 
        { opacity: 0, y: 100 },
        { 
            scrollTrigger: {
                trigger: '.about',
                start: "top 70%", // Um pouco mais tarde para garantir que a seção escura já cobriu a tela
                toggleActions: "play none none reverse"
            },
            opacity: 1, 
            y: 0, 
            duration: 1.2, 
            stagger: 0.2,
            ease: "power3.out" 
        }
    );

    // TEXTO DO CTA: Vem da esquerda, amarrado ao scroll
    gsap.fromTo('.cta-content', 
        { x: "-100vw", opacity: 0 }, // Fora da tela na esquerda
        {
            scrollTrigger: {
                trigger: '.cta',
                start: "top 90%",     // Começa quando a seção está quase entrando
                end: "center center", // Termina quando a seção chega no meio da tela
                scrub: 1              // Efeito amarrado à rolagem com 1s de suavização
            },
            x: 0,
            opacity: 1,
            ease: "power2.out"
        }
    );

    // FOTO DO CTA: Vem da direita, amarrado ao scroll
    gsap.fromTo('.photographer-cta',
        { x: "100vw", opacity: 0 }, // Fora da tela na direita
        {
            scrollTrigger: {
                trigger: '.cta',
                start: "top 90%",
                end: "center center",
                scrub: 1
            },
            x: 0,
            opacity: 1,
            ease: "power2.out"
        }
    );

    // O efeito de mouse parallax das polaroids foi movido para o fetch do CMS acima.
}

// Variável global para acessar as partículas no tick
let globalParticles = null;

// Efeito Parallax de Mouse Global no 3D
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX);
    mouseY = (event.clientY - windowHalfY);
});

// Animação contínua (Breathing Effect)
const clock = new THREE.Clock();

function tick() {
    const elapsedTime = clock.getElapsedTime();

    // Suaviza a posição do mouse (interpolação)
    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;

    // Adiciona um parallax suave em relação ao mouse na cena 3D (câmera)
    // Afeta apenas a câmera global do Three.js, não interfere no GSAP que controla o modelo
    camera.position.x += (targetX * 5 - camera.position.x) * 0.05;
    camera.position.y += (-targetY * 5 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    // Movimento leve contínuo no grupo
    if (cameraGroup) {
        cameraGroup.position.y = Math.sin(elapsedTime * 2) * 1.5;
    }
    
    // Gira as partículas mais rápido para a cena parecer veloz (chuva/grama)
    if (scene.children) {
        scene.children.forEach(child => {
            if (child.isPoints) {
                child.rotation.y = elapsedTime * 0.15; // Girando muito mais rápido
                child.rotation.x = elapsedTime * 0.08;
            }
        });
    }

    // Renderiza a cena padrão, mantendo a transparência perfeita (Alpha: true)
    renderer.render(scene, camera);
    window.requestAnimationFrame(tick);
}

tick();

// Responsividade
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

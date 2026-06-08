import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// === COLE O SEU FIREBASE CONFIG AQUI EMBAIXO ===
const firebaseConfig = {
  apiKey: "AIzaSyCRAqIwiuer6yP6fu63_8ZC8E098jJv6n8",
  authDomain: "portfolio-fotografo.firebaseapp.com",
  projectId: "portfolio-fotografo",
  storageBucket: "portfolio-fotografo.firebasestorage.app",
  messagingSenderId: "1057756685221",
  appId: "1:1057756685221:web:3a81cfd0862b3792e5be4c",
  measurementId: "G-CVSFDJ478V"
};
// ===============================================

// Inicializar Firebase apenas se o config for preenchido
let app, auth, db, storage;
if (firebaseConfig.apiKey !== "COLE_AQUI") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
} else {
    console.error("Firebase Config não configurado!");
    document.getElementById('login-error').innerText = "Sistema aguardando configuração do Firebase.";
}

// Elementos da UI
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const uploadForm = document.getElementById('upload-form');
const btnLogout = document.getElementById('btn-logout');
const photosList = document.getElementById('photos-list');
const photoFile = document.getElementById('photo-file');
const fileNameDisplay = document.getElementById('file-name');
const progressContainer = document.getElementById('upload-progress-container');
const progressBar = document.getElementById('upload-progress');
const progressStatus = document.getElementById('upload-status');

// Atualizar nome do arquivo selecionado
if (photoFile) {
    photoFile.addEventListener('change', (e) => {
        fileNameDisplay.innerText = e.target.files[0] ? e.target.files[0].name : "Nenhum arquivo escolhido";
    });
}

// Verificar se usuário está logado
if (auth) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loginContainer.style.display = 'none';
            dashboardContainer.style.display = 'block';
            loadPhotos();
        } else {
            loginContainer.style.display = 'flex';
            dashboardContainer.style.display = 'none';
        }
    });
}

// Fazer Login
if (loginForm && auth) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        signInWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                document.getElementById('login-error').innerText = "Erro: E-mail ou senha incorretos.";
            });
    });
}

// Fazer Logout
if (btnLogout && auth) {
    btnLogout.addEventListener('click', () => {
        signOut(auth);
    });
}

// Fazer Upload e Salvar no Banco
if (uploadForm && db && storage) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('photo-title').value;
        const file = photoFile.files[0];
        
        if (!file) return;

        const btnUpload = document.getElementById('btn-upload');
        btnUpload.disabled = true;
        progressContainer.style.display = 'block';
        
        // Criar referência no Storage
        const fileRef = ref(storage, `portfolio/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressBar.style.width = progress + '%';
                progressStatus.innerText = Math.round(progress) + '% Enviado';
            }, 
            (error) => {
                alert("Erro no upload: " + error.message);
                resetUploadForm();
            }, 
            async () => {
                // Upload completo, pegar URL
                progressStatus.innerText = 'Salvando no banco de dados...';
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                
                // Salvar no Firestore
                try {
                    await addDoc(collection(db, "portfolio"), {
                        title: title,
                        image: downloadURL,
                        createdAt: new Date()
                    });
                    alert("Foto publicada com sucesso!");
                    resetUploadForm();
                    loadPhotos(); // Atualizar lista
                } catch (e) {
                    alert("Erro ao salvar no banco: " + e.message);
                    resetUploadForm();
                }
            }
        );
    });
}

function resetUploadForm() {
    uploadForm.reset();
    fileNameDisplay.innerText = "Nenhum arquivo escolhido";
    document.getElementById('btn-upload').disabled = false;
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
}

// Carregar fotos do Banco
async function loadPhotos() {
    if (!db) return;
    photosList.innerHTML = '<p class="loading-text">Carregando fotos...</p>';
    
    try {
        const q = query(collection(db, "portfolio"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        photosList.innerHTML = '';
        
        if (querySnapshot.empty) {
            photosList.innerHTML = '<p style="color:#aaa;">Nenhuma foto publicada ainda.</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="photo-info">
                    <img src="${data.image}" alt="${data.title}">
                    <strong>${data.title}</strong>
                </div>
                <button class="btn danger" onclick="deletePhoto('${docSnap.id}', '${data.image}')">Excluir</button>
            `;
            photosList.appendChild(li);
        });
    } catch (error) {
        photosList.innerHTML = '<p class="error-msg">Erro ao carregar fotos.</p>';
        console.error(error);
    }
}

// Função global para excluir foto
window.deletePhoto = async function(docId, imageUrl) {
    if (confirm("Tem certeza que deseja excluir esta foto do portfólio?")) {
        try {
            // Excluir do Firestore
            await deleteDoc(doc(db, "portfolio", docId));
            
            // Excluir do Storage
            // Extrair o caminho do arquivo da URL do Firebase Storage
            const baseUrl = "https://firebasestorage.googleapis.com/v0/b/";
            if (imageUrl.includes(baseUrl)) {
                let filePath = imageUrl.split('/o/')[1].split('?alt=media')[0];
                filePath = decodeURIComponent(filePath);
                const fileRef = ref(storage, filePath);
                await deleteObject(fileRef);
            }

            alert("Foto excluída!");
            loadPhotos();
        } catch (error) {
            alert("Erro ao excluir: " + error.message);
        }
    }
}

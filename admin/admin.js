import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// FIREBASE CONFIG (Sem Storage)
const firebaseConfig = {
  apiKey: "AIzaSyCRAqIwiuer6yP6fu63_8ZC8E098jJv6n8",
  authDomain: "portfolio-fotografo.firebaseapp.com",
  projectId: "portfolio-fotografo",
  storageBucket: "portfolio-fotografo.firebasestorage.app", // Mantido apenas por padrão
  messagingSenderId: "1057756685221",
  appId: "1:1057756685221:web:3a81cfd0862b3792e5be4c",
  measurementId: "G-CVSFDJ478V"
};

// ImgBB API Key
const IMGBB_API_KEY = "2e3f55b6fd727257f5c5ce7b5569b58d";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const btnLogout = document.getElementById('btn-logout');
const photosList = document.getElementById('photos-list');

// Upload Form Elements
const uploadForm = document.getElementById('upload-form');
const photoFile = document.getElementById('photo-file');
const imagePreview = document.getElementById('image-preview');
const uploadZoneContent = document.getElementById('upload-zone-content');
const progressContainer = document.getElementById('upload-progress-container');
const progressBar = document.getElementById('upload-progress');
const progressStatus = document.getElementById('upload-status');
const btnUpload = document.getElementById('btn-upload');

// Edit Modal Elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const editPhotoTitle = document.getElementById('edit-photo-title');
const editPhotoFile = document.getElementById('edit-photo-file');
const editImagePreview = document.getElementById('edit-image-preview');
const editDocId = document.getElementById('edit-doc-id');
const editOldImageUrl = document.getElementById('edit-old-image-url');
const editProgressContainer = document.getElementById('edit-progress-container');
const editProgressBar = document.getElementById('edit-progress');
const editProgressStatus = document.getElementById('edit-status');
const btnSaveEdit = document.getElementById('btn-save-edit');

// --- AUTHENTICATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginContainer.style.display = 'none';
        dashboardContainer.style.display = 'flex';
        await checkAndMigrateOrder();
        loadPhotos();
    } else {
        loginContainer.style.display = 'flex';
        dashboardContainer.style.display = 'none';
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            document.getElementById('login-error').innerText = "Erro: E-mail ou senha incorretos.";
        });
});

btnLogout.addEventListener('click', () => signOut(auth));

// --- IMAGE PREVIEW (UPLOAD) ---
photoFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            imagePreview.src = event.target.result;
            imagePreview.style.display = 'block';
            uploadZoneContent.style.opacity = '0';
        }
        reader.readAsDataURL(file);
    } else {
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        uploadZoneContent.style.opacity = '1';
    }
});

// --- FUNÇÃO DE UPLOAD PARA IMGBB ---
async function uploadToImgBB(file, onProgress) {
    const formData = new FormData();
    formData.append("image", file);
    
    // Imitação de progresso já que o fetch normal não suporta onProgress nativo fácil
    if(onProgress) onProgress(30); 

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    });
    
    if(onProgress) onProgress(80);

    const result = await response.json();
    if (result.success) {
        if(onProgress) onProgress(100);
        return result.data.url;
    } else {
        throw new Error(result.error.message || "Erro desconhecido no ImgBB");
    }
}

// --- UPLOAD LOGIC ---
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('photo-title').value;
    const file = photoFile.files[0];
    
    if (!file) return;

    btnUpload.disabled = true;
    progressContainer.style.display = 'block';
    
    try {
        progressStatus.innerText = 'Enviando imagem para ImgBB...';
        const imageUrl = await uploadToImgBB(file, (percent) => {
            progressBar.style.width = percent + '%';
        });

        progressStatus.innerText = 'Salvando dados no Firebase...';
        
        await addDoc(collection(db, "portfolio"), {
            title: title,
            image: imageUrl,
            createdAt: new Date(),
            order: Date.now() // Vai automaticamente pro final da fila
        });

        resetUploadForm();
        loadPhotos();

    } catch (error) {
        alert("Erro ao publicar foto: " + error.message);
        resetUploadForm();
    }
});

function resetUploadForm() {
    uploadForm.reset();
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    uploadZoneContent.style.opacity = '1';
    btnUpload.disabled = false;
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
}

// --- LOAD E ORDENAÇÃO DAS FOTOS ---
let sortableInstance = null;

async function checkAndMigrateOrder() {
    // Garante que fotos antigas tenham o campo 'order' para não sumirem da galeria
    const q = query(collection(db, "portfolio"));
    const snapshot = await getDocs(q);
    let needsMigration = false;
    let docsToMigrate = [];
    
    snapshot.forEach(doc => {
        if (doc.data().order === undefined) needsMigration = true;
        docsToMigrate.push({ id: doc.id, data: doc.data() });
    });

    if (needsMigration) {
        console.log("Migrando fotos antigas para novo sistema de ordem...");
        // Ordena pela data de criação antiga (mais novas primeiro)
        docsToMigrate.sort((a, b) => {
            const timeA = a.data.createdAt ? a.data.createdAt.toMillis() : 0;
            const timeB = b.data.createdAt ? b.data.createdAt.toMillis() : 0;
            return timeB - timeA;
        });
        
        // Aplica a ordem sequencial
        let promises = [];
        for (let i = 0; i < docsToMigrate.length; i++) {
            promises.push(updateDoc(doc(db, "portfolio", docsToMigrate[i].id), { order: i }));
        }
        await Promise.all(promises);
    }
}

async function loadPhotos() {
    photosList.innerHTML = '<p class="loading-text"><i class="fa-solid fa-spinner fa-spin"></i> Carregando galeria...</p>';
    
    try {
        // Agora ordenamos pelo campo 'order'
        const q = query(collection(db, "portfolio"), orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);
        
        photosList.innerHTML = '';
        
        if (querySnapshot.empty) {
            photosList.innerHTML = '<p class="loading-text">Nenhuma foto publicada ainda.</p>';
            return;
        }

        let index = 1;
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = 'photo-card';
            div.dataset.id = docSnap.id; // Necessário para o drag & drop
            div.innerHTML = `
                <div class="order-badge">#${index}</div>
                <img src="${data.image}" alt="${data.title}" class="photo-card-img">
                <div class="photo-card-info">
                    <div class="photo-card-title">${data.title}</div>
                    <div class="photo-card-actions">
                        <button class="btn secondary text-btn" onclick="openEditModal('${docSnap.id}', '${data.title}', '${data.image}')">
                            <i class="fa-solid fa-pen"></i> Editar
                        </button>
                        <button class="btn danger-btn" onclick="deletePhoto('${docSnap.id}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            photosList.appendChild(div);
            index++;
        });

        // Inicializa o SortableJS para Drag and Drop
        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(photosList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: saveNewOrder
        });

    } catch (error) {
        photosList.innerHTML = '<p class="error-msg">Erro ao carregar fotos. Talvez o Firebase precise de um tempo para criar os índices.</p>';
        console.error(error);
    }
}

async function saveNewOrder() {
    const cards = document.querySelectorAll('.photo-card');
    
    // Feedback visual rápido
    const oldHtml = photosList.innerHTML;
    photosList.innerHTML = '<p class="loading-text"><i class="fa-solid fa-spinner fa-spin"></i> Salvando nova ordem no banco de dados...</p>';

    try {
        let orderPromises = [];
        cards.forEach((card, index) => {
            const docId = card.dataset.id;
            const promise = updateDoc(doc(db, "portfolio", docId), {
                order: index
            });
            orderPromises.push(promise);
        });
        
        // Executa todas as atualizações de forma paralela
        await Promise.all(orderPromises);
        
        // Recarrega as fotos para re-renderizar com as badges (#1, #2...) corretas
        loadPhotos();
    } catch (error) {
        console.error("Erro ao salvar nova ordem:", error);
        alert("Erro ao salvar nova ordem.");
        photosList.innerHTML = oldHtml;
        loadPhotos();
    }
}

// --- DELETE PHOTO ---
window.deletePhoto = async function(docId) {
    if (confirm("Tem certeza que deseja excluir esta foto permanentemente?")) {
        try {
            await deleteDoc(doc(db, "portfolio", docId));
            // Obs: Com ImgBB, a exclusão da imagem no servidor deles não é suportada por API de forma simples. 
            // Apenas removemos do banco de dados, o que é o suficiente.
            loadPhotos();
        } catch (error) {
            alert("Erro ao excluir: " + error.message);
        }
    }
}

// --- EDIT PHOTO LOGIC ---
window.openEditModal = function(docId, title, imageUrl) {
    editDocId.value = docId;
    editPhotoTitle.value = title;
    editOldImageUrl.value = imageUrl;
    editImagePreview.src = imageUrl;
    editModal.style.display = 'flex';
}

function closeEditModal() {
    editModal.style.display = 'none';
    editForm.reset();
    editImagePreview.src = '';
    editProgressContainer.style.display = 'none';
    btnSaveEdit.disabled = false;
}

btnCloseModal.addEventListener('click', closeEditModal);
btnCancelEdit.addEventListener('click', closeEditModal);

editPhotoFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            editImagePreview.src = event.target.result;
        }
        reader.readAsDataURL(file);
    }
});

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const docId = editDocId.value;
    const newTitle = editPhotoTitle.value;
    const newFile = editPhotoFile.files[0];
    
    btnSaveEdit.disabled = true;

    try {
        if (!newFile) {
            // Apenas atualiza o título
            await updateDoc(doc(db, "portfolio", docId), {
                title: newTitle
            });
            closeEditModal();
            loadPhotos();
        } else {
            // Fazer upload da nova imagem para ImgBB
            editProgressContainer.style.display = 'block';
            editProgressStatus.innerText = 'Enviando para ImgBB...';
            
            const imageUrl = await uploadToImgBB(newFile, (percent) => {
                editProgressBar.style.width = percent + '%';
            });
            
            editProgressStatus.innerText = 'Salvando no banco de dados...';

            // Atualiza banco com novo título e imagem
            await updateDoc(doc(db, "portfolio", docId), {
                title: newTitle,
                image: imageUrl
            });

            closeEditModal();
            loadPhotos();
        }
    } catch (error) {
        alert("Erro ao editar: " + error.message);
        btnSaveEdit.disabled = false;
    }
});

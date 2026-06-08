import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCRAqIwiuer6yP6fu63_8ZC8E098jJv6n8",
  authDomain: "portfolio-fotografo.firebaseapp.com",
  projectId: "portfolio-fotografo",
  storageBucket: "portfolio-fotografo.firebasestorage.app",
  messagingSenderId: "1057756685221",
  appId: "1:1057756685221:web:3a81cfd0862b3792e5be4c",
  measurementId: "G-CVSFDJ478V"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

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
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginContainer.style.display = 'none';
        dashboardContainer.style.display = 'flex';
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

// --- UPLOAD LOGIC ---
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('photo-title').value;
    const file = photoFile.files[0];
    
    if (!file) return;

    btnUpload.disabled = true;
    progressContainer.style.display = 'block';
    
    const fileRef = ref(storage, `portfolio/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on('state_changed', 
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressBar.style.width = progress + '%';
            progressStatus.innerText = `Enviando... ${Math.round(progress)}%`;
        }, 
        (error) => {
            alert("Erro no upload: " + error.message);
            resetUploadForm();
        }, 
        async () => {
            progressStatus.innerText = 'Salvando no banco de dados...';
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            try {
                await addDoc(collection(db, "portfolio"), {
                    title: title,
                    image: downloadURL,
                    createdAt: new Date()
                });
                resetUploadForm();
                loadPhotos();
            } catch (error) {
                alert("Erro ao salvar no banco: " + error.message);
                resetUploadForm();
            }
        }
    );
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

// --- LOAD PHOTOS ---
async function loadPhotos() {
    photosList.innerHTML = '<p class="loading-text"><i class="fa-solid fa-spinner fa-spin"></i> Carregando galeria...</p>';
    
    try {
        const q = query(collection(db, "portfolio"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        photosList.innerHTML = '';
        
        if (querySnapshot.empty) {
            photosList.innerHTML = '<p class="loading-text">Nenhuma foto publicada ainda.</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = 'photo-card';
            div.innerHTML = `
                <img src="${data.image}" alt="${data.title}" class="photo-card-img">
                <div class="photo-card-info">
                    <div class="photo-card-title">${data.title}</div>
                    <div class="photo-card-actions">
                        <button class="btn secondary text-btn" onclick="openEditModal('${docSnap.id}', '${data.title}', '${data.image}')">
                            <i class="fa-solid fa-pen"></i> Editar
                        </button>
                        <button class="btn danger-btn" onclick="deletePhoto('${docSnap.id}', '${data.image}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            photosList.appendChild(div);
        });
    } catch (error) {
        photosList.innerHTML = '<p class="error-msg">Erro ao carregar fotos.</p>';
        console.error(error);
    }
}

// --- DELETE PHOTO ---
window.deletePhoto = async function(docId, imageUrl) {
    if (confirm("Tem certeza que deseja excluir esta foto permanentemente?")) {
        try {
            await deleteDoc(doc(db, "portfolio", docId));
            
            const baseUrl = "https://firebasestorage.googleapis.com/v0/b/";
            if (imageUrl.includes(baseUrl)) {
                let filePath = imageUrl.split('/o/')[1].split('?alt=media')[0];
                filePath = decodeURIComponent(filePath);
                const fileRef = ref(storage, filePath);
                await deleteObject(fileRef);
            }
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
    const oldImageUrl = editOldImageUrl.value;
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
            // Fazer upload da nova imagem
            editProgressContainer.style.display = 'block';
            const fileRef = ref(storage, `portfolio/${Date.now()}_${newFile.name}`);
            const uploadTask = uploadBytesResumable(fileRef, newFile);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    editProgressBar.style.width = progress + '%';
                    editProgressStatus.innerText = `Atualizando... ${Math.round(progress)}%`;
                }, 
                (error) => {
                    alert("Erro no upload: " + error.message);
                    btnSaveEdit.disabled = false;
                }, 
                async () => {
                    editProgressStatus.innerText = 'Salvando...';
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    // Atualiza banco com novo título e imagem
                    await updateDoc(doc(db, "portfolio", docId), {
                        title: newTitle,
                        image: downloadURL
                    });
                    
                    // Deleta a imagem antiga do Storage
                    const baseUrl = "https://firebasestorage.googleapis.com/v0/b/";
                    if (oldImageUrl.includes(baseUrl)) {
                        let filePath = oldImageUrl.split('/o/')[1].split('?alt=media')[0];
                        filePath = decodeURIComponent(filePath);
                        const oldFileRef = ref(storage, filePath);
                        deleteObject(oldFileRef).catch(console.error); // Não precisa bloquear se falhar
                    }

                    closeEditModal();
                    loadPhotos();
                }
            );
        }
    } catch (error) {
        alert("Erro ao editar: " + error.message);
        btnSaveEdit.disabled = false;
    }
});

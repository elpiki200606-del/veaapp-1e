// 1. Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA8GnnmlGoSeaC5JaOajcZDS0ZQBpUYUIM",
  authDomain: "app-vea-2.firebaseapp.com",
  projectId: "app-vea-2",
  storageBucket: "app-vea-2.firebasestorage.app",
  messagingSenderId: "43679100188",
  appId: "1:43679100188:web:bb006e0a238f5b37035ed9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// 2. Referencias al DOM
const estadoEl = document.getElementById("estado-app");
const detalleEl = document.getElementById("detalle-conexion");
const inputPrueba = document.getElementById("texto-prueba");
const btnGuardar = document.getElementById("btn-guardar");
const listaPrueba = document.getElementById("lista-prueba");

// 3. Verificación de conexión
db.collection("ping").limit(1).get()
  .then(() => {
    estadoEl.textContent = "VEA App - Conectado";
    detalleEl.textContent = "Proyecto: " + firebaseConfig.projectId + " (Firestore OK)";
  })
  .catch((error) => {
    estadoEl.textContent = "VEA App - Error de conexión";
    detalleEl.textContent = error.message;
  });

// 4. Guardar ítems en Firestore
btnGuardar.addEventListener("click", () => {
  const texto = inputPrueba.value.trim();
  if (!texto) return;

  db.collection("pruebas").add({
    texto: texto,
    creadoEn: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    inputPrueba.value = "";
  }).catch((err) => {
    console.error("Error al guardar:", err);
  });
});

// 5. Leer ítems en tiempo real
db.collection("pruebas").orderBy("creadoEn", "desc").limit(10)
  .onSnapshot((snapshot) => {
    listaPrueba.innerHTML = "";
    snapshot.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = doc.data().texto;
      listaPrueba.appendChild(li);
    });
  }, (err) => {
    console.error("Error leyendo Firestore:", err);
  });
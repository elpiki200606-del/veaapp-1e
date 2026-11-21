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
  // 7. Menú desplegable, vistas y estado de sesión en la nube
const btnTriggerMenu = document.getElementById("btn-trigger-menu");
const dropdownUsuario = document.getElementById("dropdown-usuario");
const avatarUsuario = document.getElementById("avatar-usuario");
const textoUsuarioHeader = document.getElementById("texto-usuario-header");
const menuNombreUsuario = document.getElementById("menu-nombre-usuario");
const menuEmailUsuario = document.getElementById("menu-email-usuario");
const btnCerrarSesion = document.getElementById("btn-cerrar-sesion");
const datosPerfilNube = document.getElementById("datos-perfil-nube");

const vistasMenu = {
  perfil: document.getElementById("vista-perfil"),
  vidriera: document.getElementById("vista-vidriera"),
  cargar: document.getElementById("vista-cargar")
};

function mostrarVista(nombreVista) {
  Object.values(vistasMenu).forEach((sec) => {
    if (sec) sec.classList.add("hidden");
  });
  if (vistasMenu[nombreVista]) {
    vistasMenu[nombreVista].classList.remove("hidden");
  }
  if (dropdownUsuario) {
    dropdownUsuario.classList.add("hidden");
  }
  if (btnTriggerMenu) {
    btnTriggerMenu.setAttribute("aria-expanded", "false");
  }
}

if (btnTriggerMenu && dropdownUsuario) {
  btnTriggerMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    const seraVisible = dropdownUsuario.classList.contains("hidden");
    dropdownUsuario.classList.toggle("hidden", !seraVisible);
    btnTriggerMenu.setAttribute("aria-expanded", String(seraVisible));
  });

  document.addEventListener("click", (e) => {
    if (!dropdownUsuario.contains(e.target) && !btnTriggerMenu.contains(e.target)) {
      dropdownUsuario.classList.add("hidden");
      btnTriggerMenu.setAttribute("aria-expanded", "false");
    }
  });
}

document.querySelectorAll(".dropdown-item[data-vista]").forEach((btn) => {
  btn.addEventListener("click", () => {
    mostrarVista(btn.dataset.vista);
  });
});

if (btnCerrarSesion) {
  btnCerrarSesion.addEventListener("click", () => {
    auth.signOut().then(() => {
      mostrarVista(null);
    });
  });
}

auth.onAuthStateChanged((user) => {
  if (user) {
    const inicial = (user.email || "U").charAt(0).toUpperCase();
    if (avatarUsuario) avatarUsuario.textContent = inicial;
    if (textoUsuarioHeader) textoUsuarioHeader.textContent = user.email;
    if (menuEmailUsuario) menuEmailUsuario.textContent = user.email;

    db.collection("usuarios").doc(user.uid).get()
      .then((doc) => {
        const datos = doc.exists ? doc.data() : {};
        const nombre = datos.nombreApellido || "Usuario";
        if (menuNombreUsuario) menuNombreUsuario.textContent = nombre;
        if (textoUsuarioHeader) textoUsuarioHeader.textContent = nombre;
        if (datosPerfilNube) {
          datosPerfilNube.textContent =
            "Nombre: " + nombre +
            " | Dirección: " + (datos.direccion || "-") +
            " | Teléfono: " + (datos.telefono || "-") +
            " | Email: " + user.email;
        }
      })
      .catch((err) => {
        console.error("Error leyendo perfil en Firestore:", err);
      });
  } else {
    if (avatarUsuario) avatarUsuario.textContent = "V";
    if (textoUsuarioHeader) textoUsuarioHeader.textContent = "Sin sesión";
    if (menuNombreUsuario) menuNombreUsuario.textContent = "Invitado";
    if (menuEmailUsuario) menuEmailUsuario.textContent = "";
    if (datosPerfilNube) {
      datosPerfilNube.textContent = "Iniciá sesión para ver tu perfil guardado en la nube.";
    }
    mostrarVista(null);
  }
});
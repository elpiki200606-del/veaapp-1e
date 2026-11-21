// 1. Configuración de Firebase (SDK Compat)
const firebaseConfig = {
  apiKey: "AIzaSyA8GnmmlGoSeaC5JaOAjcZDS0ZQBpUYUIM",
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

// 6. Registro de usuarios en Firebase Auth + Firestore
const formRegistro = document.getElementById("form-registro");
const regNombre = document.getElementById("reg-nombre");
const regDireccion = document.getElementById("reg-direccion");
const regTelefono = document.getElementById("reg-telefono");
const regEmail = document.getElementById("reg-email");
const regPassword = document.getElementById("reg-password");
const regPassword2 = document.getElementById("reg-password2");
const mensajeRegistro = document.getElementById("mensaje-registro");
const seccionRegistro = document.getElementById("seccion-registro");

if (formRegistro) {
  formRegistro.addEventListener("submit", (e) => {
    e.preventDefault();

    const nombreApellido = (regNombre ? regNombre.value : "").trim();
    const direccion = (regDireccion ? regDireccion.value : "").trim();
    const telefono = (regTelefono ? regTelefono.value : "").trim();
    const email = (regEmail ? regEmail.value : "").trim();
    const password = regPassword ? regPassword.value : "";
    const password2 = regPassword2 ? regPassword2.value : "";

    if (!nombreApellido || !direccion || !telefono || !email || !password || !password2) {
      if (mensajeRegistro) mensajeRegistro.textContent = "Completá todos los campos.";
      return;
    }

    if (password.length < 6) {
      if (mensajeRegistro) mensajeRegistro.textContent = "La contraseña debe tener al menos 6 caracteres.";
      return;
    }

    if (password !== password2) {
      if (mensajeRegistro) mensajeRegistro.textContent = "Las contraseñas no coinciden.";
      return;
    }

    if (mensajeRegistro) mensajeRegistro.textContent = "Creando cuenta...";

    auth.createUserWithEmailAndPassword(email, password)
      .then((cred) => {
        const uid = cred.user.uid;
        return db.collection("usuarios").doc(uid).set({
          nombreApellido: nombreApellido,
          direccion: direccion,
          telefono: telefono,
          email: email,
          creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
      })
      .then(() => {
        if (mensajeRegistro) mensajeRegistro.textContent = "Cuenta creada correctamente.";
        formRegistro.reset();
      })
      .catch((err) => {
        console.error("Error en registro:", err);
        if (mensajeRegistro) mensajeRegistro.textContent = "Error: " + err.message;
      });
  });
}

// 7. Menú desplegable, vistas, edición de perfil y estado de sesión en la nube
const btnTriggerMenu = document.getElementById("btn-trigger-menu");
const dropdownUsuario = document.getElementById("dropdown-usuario");
const avatarUsuario = document.getElementById("avatar-usuario");
const textoUsuarioHeader = document.getElementById("texto-usuario-header");
const menuNombreUsuario = document.getElementById("menu-nombre-usuario");
const menuEmailUsuario = document.getElementById("menu-email-usuario");
const btnCerrarSesion = document.getElementById("btn-cerrar-sesion");
const datosPerfilNube = document.getElementById("datos-perfil-nube");

const formPerfil = document.getElementById("form-perfil");
const perfilFotoInput = document.getElementById("perfil-foto-input");
const previewFotoPerfil = document.getElementById("preview-foto-perfil");
const btnQuitarFoto = document.getElementById("btn-quitar-foto");
const perfilNombre = document.getElementById("perfil-nombre");
const perfilDireccion = document.getElementById("perfil-direccion");
const perfilTelefono = document.getElementById("perfil-telefono");
const btnCerrarPerfil = document.getElementById("btn-cerrar-perfil");
const mensajePerfil = document.getElementById("mensaje-perfil");

let fotoPerfilActual = "";
let usuarioActual = null;

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

function renderizarAvatarHeader(fotoBase64, fallbackTexto) {
  if (!avatarUsuario) return;
  if (fotoBase64) {
    avatarUsuario.innerHTML = `<img src="${fotoBase64}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
  } else {
    avatarUsuario.textContent = fallbackTexto;
  }
}

function renderizarPreviewFoto(fotoBase64) {
  if (!previewFotoPerfil) return;
  if (fotoBase64) {
    previewFotoPerfil.src = fotoBase64;
    previewFotoPerfil.classList.remove("hidden");
  } else {
    previewFotoPerfil.removeAttribute("src");
    previewFotoPerfil.classList.add("hidden");
  }
}

function comprimirImagenAvatar(file, maxSize = 240, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo seleccionado no es una imagen válida."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

if (perfilFotoInput) {
  perfilFotoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    comprimirImagenAvatar(file)
      .then((dataUrl) => {
        fotoPerfilActual = dataUrl;
        renderizarPreviewFoto(fotoPerfilActual);
        if (mensajePerfil) mensajePerfil.textContent = "Foto cargada. Tocá 'Guardar cambios' para guardar en la nube.";
      })
      .catch((err) => {
        console.error("Error procesando foto:", err);
        if (mensajePerfil) mensajePerfil.textContent = "Error: " + err.message;
      });
  });
}

if (btnQuitarFoto) {
  btnQuitarFoto.addEventListener("click", () => {
    fotoPerfilActual = "";
    if (perfilFotoInput) perfilFotoInput.value = "";
    renderizarPreviewFoto("");
    if (mensajePerfil) mensajePerfil.textContent = "Foto quitada. Tocá 'Guardar cambios' para confirmar.";
  });
}

if (formPerfil) {
  formPerfil.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!usuarioActual) {
      if (mensajePerfil) mensajePerfil.textContent = "Tenés que iniciar sesión primero.";
      return;
    }

    const nombreApellido = (perfilNombre ? perfilNombre.value : "").trim();
    const direccion = (perfilDireccion ? perfilDireccion.value : "").trim();
    const telefono = (perfilTelefono ? perfilTelefono.value : "").trim();

    if (!nombreApellido || !direccion || !telefono) {
      if (mensajePerfil) mensajePerfil.textContent = "Completá nombre, dirección y teléfono.";
      return;
    }

    if (mensajePerfil) mensajePerfil.textContent = "Guardando cambios...";

    const payload = {
      nombreApellido: nombreApellido,
      direccion: direccion,
      telefono: telefono,
      fotoPerfil: fotoPerfilActual,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("usuarios").doc(usuarioActual.uid).set(payload, { merge: true })
      .then(() => {
        const inicial = (usuarioActual.email || "U").charAt(0).toUpperCase();
        renderizarAvatarHeader(fotoPerfilActual, inicial);
        if (menuNombreUsuario) menuNombreUsuario.textContent = nombreApellido;
        if (textoUsuarioHeader) textoUsuarioHeader.textContent = nombreApellido;
        if (datosPerfilNube) {
          datosPerfilNube.textContent =
            "Nombre: " + nombreApellido +
            " | Dirección: " + direccion +
            " | Teléfono: " + telefono +
            " | Email: " + usuarioActual.email;
        }
        if (mensajePerfil) mensajePerfil.textContent = "Perfil actualizado en la nube.";
      })
      .catch((err) => {
        console.error("Error guardando perfil:", err);
        if (mensajePerfil) mensajePerfil.textContent = "Error al guardar: " + err.message;
      });
  });
}

if (btnCerrarPerfil) {
  btnCerrarPerfil.addEventListener("click", () => {
    mostrarVista(null);
  });
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
    if (mensajePerfil) mensajePerfil.textContent = "";
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
  usuarioActual = user || null;

  if (user) {
    if (seccionRegistro) seccionRegistro.classList.add("hidden");

    const inicial = (user.email || "U").charAt(0).toUpperCase();
    renderizarAvatarHeader("", inicial);
    if (textoUsuarioHeader) textoUsuarioHeader.textContent = user.email;
    if (menuEmailUsuario) menuEmailUsuario.textContent = user.email;

    db.collection("usuarios").doc(user.uid).get()
      .then((doc) => {
        const datos = doc.exists ? doc.data() : {};
        const nombre = datos.nombreApellido || "Usuario";
        const direccion = datos.direccion || "";
        const telefono = datos.telefono || "";
        fotoPerfilActual = datos.fotoPerfil || "";

        renderizarAvatarHeader(fotoPerfilActual, inicial);
        renderizarPreviewFoto(fotoPerfilActual);

        if (menuNombreUsuario) menuNombreUsuario.textContent = nombre;
        if (textoUsuarioHeader) textoUsuarioHeader.textContent = nombre;
        if (perfilNombre) perfilNombre.value = nombre === "Usuario" ? "" : nombre;
        if (perfilDireccion) perfilDireccion.value = direccion;
        if (perfilTelefono) perfilTelefono.value = telefono;

        if (datosPerfilNube) {
          datosPerfilNube.textContent =
            "Nombre: " + nombre +
            " | Dirección: " + (direccion || "-") +
            " | Teléfono: " + (telefono || "-") +
            " | Email: " + user.email;
        }
      })
      .catch((err) => {
        console.error("Error leyendo perfil en Firestore:", err);
      });
  } else {
    if (seccionRegistro) seccionRegistro.classList.remove("hidden");

    fotoPerfilActual = "";
    renderizarAvatarHeader("", "V");
    renderizarPreviewFoto("");
    if (textoUsuarioHeader) textoUsuarioHeader.textContent = "Sin sesión";
    if (menuNombreUsuario) menuNombreUsuario.textContent = "Invitado";
    if (menuEmailUsuario) menuEmailUsuario.textContent = "";
    if (perfilNombre) perfilNombre.value = "";
    if (perfilDireccion) perfilDireccion.value = "";
    if (perfilTelefono) perfilTelefono.value = "";
    if (datosPerfilNube) {
      datosPerfilNube.textContent = "Iniciá sesión para ver tu perfil guardado en la nube.";
    }
    mostrarVista(null);
  }
});
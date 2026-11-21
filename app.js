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

// 6. Registro e inicio de sesión en Firebase Auth + Firestore
const formRegistro = document.getElementById("form-registro");
const regNombre = document.getElementById("reg-nombre");
const regDireccion = document.getElementById("reg-direccion");
const regTelefono = document.getElementById("reg-telefono");
const regEmail = document.getElementById("reg-email");
const regPassword = document.getElementById("reg-password");
const regPassword2 = document.getElementById("reg-password2");
const mensajeRegistro = document.getElementById("mensaje-registro");
const seccionRegistro = document.getElementById("seccion-registro");

const seccionLogin = document.getElementById("seccion-login");
const formLogin = document.getElementById("form-login");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const mensajeLogin = document.getElementById("mensaje-login");
const btnIrRegistro = document.getElementById("btn-ir-registro");
const btnIrLogin = document.getElementById("btn-ir-login");

function alternarAuth(mostrarLogin) {
  if (typeof usuarioActual !== "undefined" && usuarioActual) return;
  if (seccionLogin) seccionLogin.classList.toggle("hidden", !mostrarLogin);
  if (seccionRegistro) seccionRegistro.classList.toggle("hidden", mostrarLogin);
  if (mensajeLogin) mensajeLogin.textContent = "";
  if (mensajeRegistro) mensajeRegistro.textContent = "";
}

if (btnIrRegistro) {
  btnIrRegistro.addEventListener("click", () => alternarAuth(false));
}

if (btnIrLogin) {
  btnIrLogin.addEventListener("click", () => alternarAuth(true));
}

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
          plan: "basico",
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

if (formLogin) {
  formLogin.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = (loginEmail ? loginEmail.value : "").trim();
    const password = loginPassword ? loginPassword.value : "";

    if (!email || !password) {
      if (mensajeLogin) mensajeLogin.textContent = "Completá correo y contraseña.";
      return;
    }

    if (mensajeLogin) mensajeLogin.textContent = "Iniciando sesión y recuperando datos...";

    auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        if (mensajeLogin) mensajeLogin.textContent = "Sesión iniciada.";
        formLogin.reset();
      })
      .catch((err) => {
        console.error("Error en login:", err);
        if (mensajeLogin) mensajeLogin.textContent = "Error al iniciar sesión: " + err.message;
      });
  });
}

// 7. Menú desplegable, Perfil editable y Vidriera Comercial
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

const badgePlanVidriera = document.getElementById("badge-plan-vidriera");
const estadoPlanDetalle = document.getElementById("estado-plan-detalle");
const formVidriera = document.getElementById("form-vidriera");
const vidNombreComercio = document.getElementById("vid-nombre-comercio");
const vidDireccion = document.getElementById("vid-direccion");
const vidTelefono = document.getElementById("vid-telefono");
const vidSugerenciasDireccion = document.getElementById("vid-sugerencias-direccion");
const vidCoordsTexto = document.getElementById("vid-coords-texto");
const vidFachadaInput = document.getElementById("vid-fachada-input");
const vidPreviewFachada = document.getElementById("vid-preview-fachada");
const btnQuitarFachada = document.getElementById("btn-quitar-fachada");
const labelVideoVidriera = document.getElementById("label-video-vidriera");
const vidVideoInput = document.getElementById("vid-video-input");
const vidVideoEstado = document.getElementById("vid-video-estado");
const vidPreviewVideo = document.getElementById("vid-preview-video");
const btnQuitarVideo = document.getElementById("btn-quitar-video");
const vidCuponTitulo = document.getElementById("vid-cupon-titulo");
const vidCuponCodigo = document.getElementById("vid-cupon-codigo");
const btnAgregarCupon = document.getElementById("btn-agregar-cupon");
const vidListaCupones = document.getElementById("vid-lista-cupones");
const labelPublicacionesVidriera = document.getElementById("label-publicaciones-vidriera");
const vidPubFoto = document.getElementById("vid-pub-foto");
const vidPubTitulo = document.getElementById("vid-pub-titulo");
const vidPubDescripcion = document.getElementById("vid-pub-descripcion");
const btnAgregarPublicacion = document.getElementById("btn-agregar-publicacion");
const vidListaPublicaciones = document.getElementById("vid-lista-publicaciones");
const btnCerrarVidriera = document.getElementById("btn-cerrar-vidriera");
const mensajeVidriera = document.getElementById("mensaje-vidriera");
const vidrieraReflejoContenido = document.getElementById("vidriera-reflejo-contenido");

const PLANES_VEA = {
  basico: { nombre: "BÁSICO", maxPubs: 10, maxVideoSec: 10 },
  estandar: { nombre: "ESTÁNDAR", maxPubs: 20, maxVideoSec: 20 },
  premium: { nombre: "PREMIUM", maxPubs: 40, maxVideoSec: 60 }
};

let fotoPerfilActual = "";
let telefonoUsuarioActual = "";
let usuarioActual = null;
let planActualUsuario = "basico";
let fotoFachadaActual = "";
let videoVerticalActual = "";
let cuponesVidriera = [];
let publicacionesVidriera = [];
let latVidriera = -34.6434;
let lngVidriera = -58.6231;
let mapaVidriera = null;
let pinVidriera = null;
let timerSugerencias = null;

const vistasMenu = {
  perfil: document.getElementById("vista-perfil"),
  vidriera: document.getElementById("vista-vidriera")
};

function mostrarVista(nombreVista) {
  Object.values(vistasMenu).forEach((sec) => {
    if (sec) sec.classList.add("hidden");
  });
  if (vistasMenu[nombreVista]) {
    vistasMenu[nombreVista].classList.remove("hidden");
  }
  if (nombreVista === "vidriera") {
    inicializarMapaVidriera();
  }
  if (dropdownUsuario) {
    dropdownUsuario.classList.add("hidden");
  }
  if (btnTriggerMenu) {
    btnTriggerMenu.setAttribute("aria-expanded", "false");
  }
}

function escaparHTML(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function formatearWhatsAppUrl(telefono) {
  let digits = String(telefono ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("549")) {
    if (digits.startsWith("54") && !digits.startsWith("549")) {
      digits = "549" + digits.slice(2);
    } else if (digits.length >= 10 && digits.length <= 11) {
      digits = "549" + digits;
    }
  }
  return `https://wa.me/${digits}`;
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

function comprimirImagen(file, maxSize = 240, quality = 0.78) {
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

    comprimirImagen(file, 240, 0.78)
      .then((dataUrl) => {
        fotoPerfilActual = dataUrl;
        renderizarPreviewFoto(fotoPerfilActual);
        if (mensajePerfil) mensajePerfil.textContent = "Foto cargada. Tocá 'Guardar cambios' para guardar en la nube.";
      })
      .catch((err) => {
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
    if (!usuarioActual) return;

    const nombreApellido = (perfilNombre ? perfilNombre.value : "").trim();
    const direccion = (perfilDireccion ? perfilDireccion.value : "").trim();
    const telefono = (perfilTelefono ? perfilTelefono.value : "").trim();

    if (!nombreApellido || !direccion || !telefono) {
      if (mensajePerfil) mensajePerfil.textContent = "Completá nombre, dirección y teléfono.";
      return;
    }

    if (mensajePerfil) mensajePerfil.textContent = "Guardando cambios...";

    db.collection("usuarios").doc(usuarioActual.uid).set({
      nombreApellido: nombreApellido,
      direccion: direccion,
      telefono: telefono,
      fotoPerfil: fotoPerfilActual,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
      .then(() => {
        telefonoUsuarioActual = telefono;
        if (vidTelefono && !vidTelefono.value.trim()) {
          vidTelefono.value = telefono;
        }
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
        if (mensajePerfil) mensajePerfil.textContent = "Error al guardar: " + err.message;
      });
  });
}

if (btnCerrarPerfil) {
  btnCerrarPerfil.addEventListener("click", () => mostrarVista(null));
}

function obtenerConfigPlan() {
  return PLANES_VEA[planActualUsuario] || PLANES_VEA.basico;
}

function actualizarUIPlanVidriera() {
  const cfg = obtenerConfigPlan();
  if (badgePlanVidriera) badgePlanVidriera.textContent = "Plan activo: " + cfg.nombre;
  if (estadoPlanDetalle) {
    estadoPlanDetalle.textContent = `Límites de tu plan: hasta ${cfg.maxPubs} publicaciones y video vertical de hasta ${cfg.maxVideoSec}s.`;
  }
  if (labelVideoVidriera) {
    labelVideoVidriera.textContent = `Video promocional vertical (máximo ${cfg.maxVideoSec}s según tu plan)`;
  }
  if (labelPublicacionesVidriera) {
    labelPublicacionesVidriera.textContent = `Publicaciones (${publicacionesVidriera.length} / ${cfg.maxPubs} máx.)`;
  }
}

function inicializarMapaVidriera() {
  const cont = document.getElementById("vidriera-mapa");
  if (!cont || typeof L === "undefined") return;

  if (!mapaVidriera) {
    mapaVidriera = L.map("vidriera-mapa").setView([latVidriera, lngVidriera], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(mapaVidriera);
    pinVidriera = L.marker([latVidriera, lngVidriera]).addTo(mapaVidriera);
  } else {
    mapaVidriera.setView([latVidriera, lngVidriera], 15);
    if (pinVidriera) pinVidriera.setLatLng([latVidriera, lngVidriera]);
  }
  setTimeout(() => mapaVidriera.invalidateSize(), 180);
}

function actualizarCoordenadasVidriera(lat, lng, etiqueta) {
  latVidriera = lat;
  lngVidriera = lng;
  if (vidCoordsTexto) {
    vidCoordsTexto.textContent = `Ubicación fijada: ${etiqueta || ""} (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  }
  inicializarMapaVidriera();
}

if (vidDireccion && vidSugerenciasDireccion) {
  vidDireccion.addEventListener("input", () => {
    const q = vidDireccion.value.trim();
    if (q.length < 4) {
      vidSugerenciasDireccion.classList.add("hidden");
      return;
    }

    clearTimeout(timerSugerencias);
    timerSugerencias = setTimeout(() => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ar&limit=6&q=${encodeURIComponent(q + ", Argentina")}`;
      fetch(url)
        .then((res) => res.json())
        .then((resultados) => {
          vidSugerenciasDireccion.innerHTML = "";
          if (!resultados || !resultados.length) {
            vidSugerenciasDireccion.classList.add("hidden");
            return;
          }
          resultados.forEach((lugar) => {
            const item = document.createElement("div");
            item.style.cssText = "padding:8px 10px; font-size:0.82rem; border-bottom:1px solid #eee; cursor:pointer;";
            item.textContent = lugar.display_name;
            item.addEventListener("click", () => {
              vidDireccion.value = lugar.display_name;
              vidSugerenciasDireccion.classList.add("hidden");
              actualizarCoordenadasVidriera(parseFloat(lugar.lat), parseFloat(lugar.lon), lugar.display_name);
            });
            vidSugerenciasDireccion.appendChild(item);
          });
          vidSugerenciasDireccion.classList.remove("hidden");
        })
        .catch((err) => {
          console.error("Error buscando direcciones:", err);
        });
    }, 350);
  });
}

function renderizarPreviewFachada(dataUrl) {
  if (!vidPreviewFachada) return;
  if (dataUrl) {
    vidPreviewFachada.src = dataUrl;
    vidPreviewFachada.classList.remove("hidden");
  } else {
    vidPreviewFachada.removeAttribute("src");
    vidPreviewFachada.classList.add("hidden");
  }
}

if (vidFachadaInput) {
  vidFachadaInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    comprimirImagen(file, 640, 0.75)
      .then((dataUrl) => {
        fotoFachadaActual = dataUrl;
        renderizarPreviewFachada(fotoFachadaActual);
        if (mensajeVidriera) mensajeVidriera.textContent = "Foto de fachada cargada. Tocá 'Guardar y actualizar vidriera'.";
      })
      .catch((err) => {
        if (mensajeVidriera) mensajeVidriera.textContent = "Error en fachada: " + err.message;
      });
  });
}

if (btnQuitarFachada) {
  btnQuitarFachada.addEventListener("click", () => {
    fotoFachadaActual = "";
    if (vidFachadaInput) vidFachadaInput.value = "";
    renderizarPreviewFachada("");
  });
}

function renderizarPreviewVideo(dataUrl) {
  if (!vidPreviewVideo) return;
  if (dataUrl) {
    vidPreviewVideo.src = dataUrl;
    vidPreviewVideo.classList.remove("hidden");
    if (btnQuitarVideo) btnQuitarVideo.classList.remove("hidden");
  } else {
    vidPreviewVideo.removeAttribute("src");
    vidPreviewVideo.classList.add("hidden");
    if (btnQuitarVideo) btnQuitarVideo.classList.add("hidden");
  }
}

if (vidVideoInput) {
  vidVideoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const cfg = obtenerConfigPlan();
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);
    tempVideo.src = objectUrl;

    tempVideo.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const duracion = tempVideo.duration;
      const ancho = tempVideo.videoWidth;
      const alto = tempVideo.videoHeight;

      if (ancho >= alto) {
        vidVideoInput.value = "";
        if (vidVideoEstado) {
          vidVideoEstado.textContent = `Rechazado: el video es horizontal (${ancho}x${alto}). Subí un video vertical.`;
        }
        return;
      }

      if (duracion > cfg.maxVideoSec) {
        vidVideoInput.value = "";
        if (vidVideoEstado) {
          vidVideoEstado.textContent = `Rechazado: dura ${Math.round(duracion)}s y tu plan ${cfg.nombre} permite hasta ${cfg.maxVideoSec}s.`;
        }
        return;
      }

      if (file.size > 700 * 1024) {
        vidVideoInput.value = "";
        if (vidVideoEstado) {
          vidVideoEstado.textContent = "El video supera los 700 KB para guardarse directo en la nube de prueba. Comprimilo un poco más.";
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        videoVerticalActual = reader.result;
        renderizarPreviewVideo(videoVerticalActual);
        if (vidVideoEstado) {
          vidVideoEstado.textContent = `Video vertical válido (${ancho}x${alto}, ${Math.round(duracion)}s). Guardá la vidriera para aplicarlo.`;
        }
      };
      reader.readAsDataURL(file);
    };
  });
}

if (btnQuitarVideo) {
  btnQuitarVideo.addEventListener("click", () => {
    videoVerticalActual = "";
    if (vidVideoInput) vidVideoInput.value = "";
    renderizarPreviewVideo("");
    if (vidVideoEstado) vidVideoEstado.textContent = "Video quitado.";
  });
}

function renderizarCuponesVidriera() {
  if (!vidListaCupones) return;
  vidListaCupones.innerHTML = "";
  cuponesVidriera.forEach((cup, idx) => {
    const li = document.createElement("li");
    li.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:4px;";
    li.innerHTML = `<span>🎟️ <strong>${escaparHTML(cup.titulo)}</strong> — Código: <code>${escaparHTML(cup.codigo)}</code></span>`;
    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.textContent = "Eliminar";
    btnDel.addEventListener("click", () => {
      cuponesVidriera.splice(idx, 1);
      renderizarCuponesVidriera();
    });
    li.appendChild(btnDel);
    vidListaCupones.appendChild(li);
  });
}

if (btnAgregarCupon) {
  btnAgregarCupon.addEventListener("click", () => {
    const titulo = (vidCuponTitulo ? vidCuponTitulo.value : "").trim();
    const codigo = (vidCuponCodigo ? vidCuponCodigo.value : "").trim().toUpperCase();
    if (!titulo || !codigo) {
      if (mensajeVidriera) mensajeVidriera.textContent = "Completá título y código del cupón.";
      return;
    }
    cuponesVidriera.push({ titulo, codigo });
    if (vidCuponTitulo) vidCuponTitulo.value = "";
    if (vidCuponCodigo) vidCuponCodigo.value = "";
    renderizarCuponesVidriera();
  });
}

function renderizarPublicacionesVidriera() {
  actualizarUIPlanVidriera();
  if (!vidListaPublicaciones) return;
  vidListaPublicaciones.innerHTML = "";

  publicacionesVidriera.forEach((pub, idx) => {
    const card = document.createElement("div");
    card.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px; border:1px solid #cbd5e1; border-radius:8px; padding:8px; margin-bottom:6px;";
    const thumb = pub.foto
      ? `<img src="${pub.foto}" alt="" style="width:48px; height:48px; object-fit:cover; border-radius:6px;">`
      : "";
    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        ${thumb}
        <div>
          <strong>${escaparHTML(pub.titulo)}</strong>
          <p class="subtexto" style="margin:0;">${escaparHTML(pub.descripcion)}</p>
        </div>
      </div>
    `;
    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.textContent = "Eliminar";
    btnDel.addEventListener("click", () => {
      publicacionesVidriera.splice(idx, 1);
      renderizarPublicacionesVidriera();
    });
    card.appendChild(btnDel);
    vidListaPublicaciones.appendChild(card);
  });
}

if (btnAgregarPublicacion) {
  btnAgregarPublicacion.addEventListener("click", async () => {
    const cfg = obtenerConfigPlan();
    if (publicacionesVidriera.length >= cfg.maxPubs) {
      if (mensajeVidriera) {
        mensajeVidriera.textContent = `Alcanzaste el límite de ${cfg.maxPubs} publicaciones de tu plan ${cfg.nombre}.`;
      }
      return;
    }

    const titulo = (vidPubTitulo ? vidPubTitulo.value : "").trim();
    const descripcion = (vidPubDescripcion ? vidPubDescripcion.value : "").trim();
    const file = vidPubFoto && vidPubFoto.files ? vidPubFoto.files[0] : null;

    if (!titulo || !descripcion) {
      if (mensajeVidriera) mensajeVidriera.textContent = "Completá título y descripción de la publicación.";
      return;
    }

    let fotoData = "";
    if (file) {
      try {
        fotoData = await comprimirImagen(file, 480, 0.72);
      } catch (err) {
        if (mensajeVidriera) mensajeVidriera.textContent = "Error en foto de publicación: " + err.message;
        return;
      }
    }

    publicacionesVidriera.push({
      titulo: titulo,
      descripcion: descripcion,
      foto: fotoData
    });

    if (vidPubTitulo) vidPubTitulo.value = "";
    if (vidPubDescripcion) vidPubDescripcion.value = "";
    if (vidPubFoto) vidPubFoto.value = "";
    renderizarPublicacionesVidriera();
  });
}

function renderizarReflejoVidriera(datos) {
  if (!vidrieraReflejoContenido) return;
  if (!datos || !datos.nombreComercio) {
    vidrieraReflejoContenido.textContent = "Guardá tu vidriera para verla reflejada acá.";
    return;
  }

  const telefonoVisible = (datos.telefono || telefonoUsuarioActual || "").trim();
  const waUrl = formatearWhatsAppUrl(telefonoVisible);
  const badgeWhatsAppSvg = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="flex:0 0 auto;"><circle cx="12" cy="12" r="12" fill="#25D366"/><path fill="#ffffff" d="M17.47 14.38c-.28-.14-1.65-.81-1.91-.9-.26-.1-.44-.14-.63.14-.19.28-.72.9-.88 1.09-.16.19-.32.21-.6.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.39-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.63-1.52-.86-2.08-.23-.55-.46-.47-.63-.48h-.54c-.19 0-.49.07-.75.35-.26.28-.98.96-.98 2.34s1 2.71 1.14 2.9c.14.19 1.97 3.01 4.78 4.22.67.29 1.19.46 1.6.59.67.21 1.28.18 1.76.11.54-.08 1.65-.67 1.88-1.32.23-.65.23-1.21.16-1.32-.07-.12-.26-.19-.54-.33z"/></svg>`;

  const contactoWhatsAppHtml = telefonoVisible
    ? `<div style="display:inline-flex; align-items:center; gap:8px; flex-wrap:wrap; margin:6px 0 10px; padding:8px 12px; border-radius:10px; background:#f0fdf4; border:1px solid #86efac; color:#14532d; font-size:0.9rem;">
        ${badgeWhatsAppSvg}
        <span>Consultas al WhatsApp:</span>
        ${waUrl
          ? `<a href="${escaparHTML(waUrl)}" target="_blank" rel="noopener" style="font-weight:700; color:#15803d; text-decoration:underline;">${escaparHTML(telefonoVisible)}</a>`
          : `<strong>${escaparHTML(telefonoVisible)}</strong>`}
      </div>`
    : `<p class="subtexto">Consultas al WhatsApp: número no cargado.</p>`;

  const fachadaHtml = datos.fotoFachada
    ? `<img src="${datos.fotoFachada}" alt="Fachada" style="width:100%; max-height:180px; object-fit:cover; border-radius:8px; margin-bottom:8px;">`
    : "";

  const videoHtml = datos.videoVertical
    ? `<video controls playsinline src="${datos.videoVertical}" style="width:150px; max-height:260px; border-radius:8px; background:#000; display:block; margin:8px 0;"></video>`
    : "";

  const cuponesHtml = (datos.cupones || []).length
    ? `<ul>${datos.cupones.map((c) => `<li>🎟️ <strong>${escaparHTML(c.titulo)}</strong> — Código: <code>${escaparHTML(c.codigo)}</code></li>`).join("")}</ul>`
    : `<p class="subtexto">Sin cupones activos.</p>`;

  const pubsHtml = (datos.publicaciones || []).length
    ? `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:8px; margin-top:8px;">
        ${datos.publicaciones.map((p) => `
          <div style="border:1px solid #cbd5e1; border-radius:8px; padding:8px;">
            ${p.foto ? `<img src="${p.foto}" alt="" style="width:100%; height:110px; object-fit:cover; border-radius:6px; margin-bottom:4px;">` : ""}
            <strong>${escaparHTML(p.titulo)}</strong>
            <p class="subtexto" style="margin:2px 0 0;">${escaparHTML(p.descripcion)}</p>
          </div>
        `).join("")}
      </div>`
    : `<p class="subtexto">Sin publicaciones cargadas.</p>`;

  vidrieraReflejoContenido.innerHTML = `
    ${fachadaHtml}
    <h4>${escaparHTML(datos.nombreComercio)}</h4>
    <p class="subtexto">📍 ${escaparHTML(datos.direccion || "")}</p>
    ${contactoWhatsAppHtml}
    ${videoHtml}
    <strong>Cupones vigentes</strong>
    ${cuponesHtml}
    <strong>Publicaciones</strong>
    ${pubsHtml}
  `;
}

if (formVidriera) {
  formVidriera.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!usuarioActual) {
      if (mensajeVidriera) mensajeVidriera.textContent = "Tenés que iniciar sesión para guardar tu vidriera.";
      return;
    }

    const nombreComercio = (vidNombreComercio ? vidNombreComercio.value : "").trim();
    const direccion = (vidDireccion ? vidDireccion.value : "").trim();
    const telefonoComercio = ((vidTelefono ? vidTelefono.value : "").trim()) || telefonoUsuarioActual;

    if (!nombreComercio || !direccion) {
      if (mensajeVidriera) mensajeVidriera.textContent = "Completá el nombre del comercio y la dirección.";
      return;
    }

    if (mensajeVidriera) mensajeVidriera.textContent = "Guardando vidriera en la nube...";

    const payloadVidriera = {
      uid: usuarioActual.uid,
      email: usuarioActual.email,
      plan: planActualUsuario,
      nombreComercio: nombreComercio,
      direccion: direccion,
      telefono: telefonoComercio,
      whatsappUrl: formatearWhatsAppUrl(telefonoComercio),
      lat: latVidriera,
      lng: lngVidriera,
      fotoFachada: fotoFachadaActual,
      videoVertical: videoVerticalActual,
      cupones: cuponesVidriera,
      publicaciones: publicacionesVidriera,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("comercios").doc(usuarioActual.uid).set(payloadVidriera, { merge: true })
      .then(() => {
        if (vidTelefono && !vidTelefono.value.trim() && telefonoComercio) {
          vidTelefono.value = telefonoComercio;
        }
        renderizarReflejoVidriera(payloadVidriera);
        if (mensajeVidriera) mensajeVidriera.textContent = "Vidriera guardada y reflejada correctamente.";
      })
      .catch((err) => {
        console.error("Error guardando vidriera:", err);
        if (mensajeVidriera) mensajeVidriera.textContent = "Error al guardar vidriera: " + err.message;
      });
  });
}

if (btnCerrarVidriera) {
  btnCerrarVidriera.addEventListener("click", () => mostrarVista(null));
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
    if (mensajeVidriera) mensajeVidriera.textContent = "";
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
    if (seccionLogin) seccionLogin.classList.add("hidden");

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
        telefonoUsuarioActual = telefono;
        fotoPerfilActual = datos.fotoPerfil || "";
        planActualUsuario = (datos.plan && PLANES_VEA[datos.plan]) ? datos.plan : "basico";

        renderizarAvatarHeader(fotoPerfilActual, inicial);
        renderizarPreviewFoto(fotoPerfilActual);
        actualizarUIPlanVidriera();

        if (menuNombreUsuario) menuNombreUsuario.textContent = nombre;
        if (textoUsuarioHeader) textoUsuarioHeader.textContent = nombre;
        if (perfilNombre) perfilNombre.value = nombre === "Usuario" ? "" : nombre;
        if (perfilDireccion) perfilDireccion.value = direccion;
        if (perfilTelefono) perfilTelefono.value = telefono;
        if (vidTelefono && !vidTelefono.value.trim() && telefono) {
          vidTelefono.value = telefono;
        }

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

    db.collection("comercios").doc(user.uid).get()
      .then((doc) => {
        if (!doc.exists) {
          renderizarCuponesVidriera();
          renderizarPublicacionesVidriera();
          renderizarReflejoVidriera(null);
          return;
        }
        const com = doc.data();
        if (com.plan && PLANES_VEA[com.plan]) planActualUsuario = com.plan;
        if (vidNombreComercio) vidNombreComercio.value = com.nombreComercio || "";
        if (vidDireccion) vidDireccion.value = com.direccion || "";
        if (vidTelefono) vidTelefono.value = com.telefono || telefonoUsuarioActual || "";
        latVidriera = Number.isFinite(com.lat) ? com.lat : -34.6434;
        lngVidriera = Number.isFinite(com.lng) ? com.lng : -58.6231;
        fotoFachadaActual = com.fotoFachada || "";
        videoVerticalActual = com.videoVertical || "";
        cuponesVidriera = Array.isArray(com.cupones) ? com.cupones : [];
        publicacionesVidriera = Array.isArray(com.publicaciones) ? com.publicaciones : [];

        renderizarPreviewFachada(fotoFachadaActual);
        renderizarPreviewVideo(videoVerticalActual);
        renderizarCuponesVidriera();
        renderizarPublicacionesVidriera();
        renderizarReflejoVidriera(com);
      })
      .catch((err) => {
        console.error("Error leyendo vidriera en Firestore:", err);
      });
  } else {
    if (seccionRegistro) seccionRegistro.classList.add("hidden");
    if (seccionLogin) seccionLogin.classList.add("hidden");

    fotoPerfilActual = "";
    telefonoUsuarioActual = "";
    planActualUsuario = "basico";
    fotoFachadaActual = "";
    videoVerticalActual = "";
    cuponesVidriera = [];
    publicacionesVidriera = [];
    renderizarAvatarHeader("", "V");
    renderizarPreviewFoto("");
    renderizarPreviewFachada("");
    renderizarPreviewVideo("");
    renderizarCuponesVidriera();
    renderizarPublicacionesVidriera();
    renderizarReflejoVidriera(null);

    if (textoUsuarioHeader) textoUsuarioHeader.textContent = "Sin sesión";
    if (menuNombreUsuario) menuNombreUsuario.textContent = "Invitado";
    if (menuEmailUsuario) menuEmailUsuario.textContent = "";
    if (perfilNombre) perfilNombre.value = "";
    if (perfilDireccion) perfilDireccion.value = "";
    if (perfilTelefono) perfilTelefono.value = "";
    if (vidTelefono) vidTelefono.value = "";
    if (datosPerfilNube) {
      datosPerfilNube.textContent = "Iniciá sesión para ver tu perfil guardado en la nube.";
    }
    mostrarVista(null);
  }
});
// 8. Pantalla principal pública: mapa, buscador, grilla y detalle de vidriera
const inputBuscarComercio = document.getElementById("buscar-comercio");
const btnLimpiarBusqueda = document.getElementById("btn-limpiar-busqueda");
const contadorComercios = document.getElementById("contador-comercios");
const listaComerciosPublicos = document.getElementById("lista-comercios-publicos");
const detalleComercioPublico = document.getElementById("detalle-comercio-publico");
const contenidoDetalleComercio = document.getElementById("contenido-detalle-comercio");
const btnCerrarDetalleComercio = document.getElementById("btn-cerrar-detalle-comercio");

let comerciosCargados = [];
let mapaPrincipal = null;
let capaMarcadoresPrincipal = null;

function inicializarMapaPrincipal() {
  const cont = document.getElementById("mapa-principal");
  if (!cont || typeof L === "undefined") return;

  if (!mapaPrincipal) {
    mapaPrincipal = L.map("mapa-principal").setView([-34.6434, -58.6231], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(mapaPrincipal);
    capaMarcadoresPrincipal = L.layerGroup().addTo(mapaPrincipal);
  }
  setTimeout(() => mapaPrincipal.invalidateSize(), 180);
}

function construirHtmlVidrieraPublica(datos) {
  const telefonoVisible = (datos.telefono || "").trim();
  const waUrl = datos.whatsappUrl || formatearWhatsAppUrl(telefonoVisible);
  const badgeWhatsAppSvg = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="flex:0 0 auto;"><circle cx="12" cy="12" r="12" fill="#25D366"/><path fill="#ffffff" d="M17.47 14.38c-.28-.14-1.65-.81-1.91-.9-.26-.1-.44-.14-.63.14-.19.28-.72.9-.88 1.09-.16.19-.32.21-.6.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.39-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.63-1.52-.86-2.08-.23-.55-.46-.47-.63-.48h-.54c-.19 0-.49.07-.75.35-.26.28-.98.96-.98 2.34s1 2.71 1.14 2.9c.14.19 1.97 3.01 4.78 4.22.67.29 1.19.46 1.6.59.67.21 1.28.18 1.76.11.54-.08 1.65-.67 1.88-1.32.23-.65.23-1.21.16-1.32-.07-.12-.26-.19-.54-.33z"/></svg>`;

  const contactoWhatsAppHtml = telefonoVisible
    ? `<div style="display:inline-flex; align-items:center; gap:8px; flex-wrap:wrap; margin:6px 0 10px; padding:8px 12px; border-radius:10px; background:#f0fdf4; border:1px solid #86efac; color:#14532d; font-size:0.9rem;">
        ${badgeWhatsAppSvg}
        <span>Consultas al WhatsApp:</span>
        ${waUrl
          ? `<a href="${escaparHTML(waUrl)}" target="_blank" rel="noopener" style="font-weight:700; color:#15803d; text-decoration:underline;">${escaparHTML(telefonoVisible)}</a>`
          : `<strong>${escaparHTML(telefonoVisible)}</strong>`}
      </div>`
    : `<p class="subtexto">Consultas al WhatsApp: número no cargado.</p>`;

  const fachadaHtml = datos.fotoFachada
    ? `<img src="${datos.fotoFachada}" alt="Fachada" style="width:100%; max-height:200px; object-fit:cover; border-radius:8px; margin-bottom:10px;">`
    : "";

  const videoHtml = datos.videoVertical
    ? `<video controls playsinline src="${datos.videoVertical}" style="width:150px; max-height:260px; border-radius:8px; background:#000; display:block; margin:10px 0;"></video>`
    : "";

  const cuponesHtml = (datos.cupones || []).length
    ? `<ul>${datos.cupones.map((c) => `<li>🎟️ <strong>${escaparHTML(c.titulo)}</strong> — Código: <code>${escaparHTML(c.codigo)}</code></li>`).join("")}</ul>`
    : `<p class="subtexto">Sin cupones activos.</p>`;

  const pubsHtml = (datos.publicaciones || []).length
    ? `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:8px; margin-top:8px;">
        ${datos.publicaciones.map((p) => `
          <div style="border:1px solid #cbd5e1; border-radius:8px; padding:8px; background:#fff;">
            ${p.foto ? `<img src="${p.foto}" alt="" style="width:100%; height:110px; object-fit:cover; border-radius:6px; margin-bottom:4px;">` : ""}
            <strong>${escaparHTML(p.titulo)}</strong>
            <p class="subtexto" style="margin:2px 0 0;">${escaparHTML(p.descripcion)}</p>
          </div>
        `).join("")}
      </div>`
    : `<p class="subtexto">Sin publicaciones cargadas.</p>`;

  return `
    ${fachadaHtml}
    <h4>${escaparHTML(datos.nombreComercio)}</h4>
    <p class="subtexto">📍 ${escaparHTML(datos.direccion || "")}</p>
    ${contactoWhatsAppHtml}
    ${videoHtml}
    <strong>Cupones vigentes</strong>
    ${cuponesHtml}
    <strong style="display:block; margin-top:8px;">Publicaciones</strong>
    ${pubsHtml}
  `;
}

function abrirDetalleComercio(comercio) {
  if (!detalleComercioPublico || !contenidoDetalleComercio || !comercio) return;
  contenidoDetalleComercio.innerHTML = construirHtmlVidrieraPublica(comercio);
  detalleComercioPublico.classList.remove("hidden");
  if (mapaPrincipal && Number.isFinite(comercio.lat) && Number.isFinite(comercio.lng)) {
    mapaPrincipal.setView([comercio.lat, comercio.lng], 16);
  }
  detalleComercioPublico.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderizarComerciosPublicos(lista) {
  inicializarMapaPrincipal();
  if (capaMarcadoresPrincipal) {
    capaMarcadoresPrincipal.clearLayers();
  }

  if (contadorComercios) {
    contadorComercios.textContent = lista.length === 1
      ? "1 comercio encontrado."
      : `${lista.length} comercios encontrados.`;
  }

  if (!listaComerciosPublicos) return;
  listaComerciosPublicos.innerHTML = "";

  if (!lista.length) {
    listaComerciosPublicos.innerHTML = `<p class="subtexto">No hay comercios que coincidan con la búsqueda.</p>`;
    return;
  }

  const limites = [];

  lista.forEach((com) => {
    if (Number.isFinite(com.lat) && Number.isFinite(com.lng) && capaMarcadoresPrincipal) {
      const marker = L.marker([com.lat, com.lng]).addTo(capaMarcadoresPrincipal);
      marker.bindPopup(`<strong>${escaparHTML(com.nombreComercio)}</strong><br>${escaparHTML(com.direccion || "")}`);
      marker.on("click", () => abrirDetalleComercio(com));
      limites.push([com.lat, com.lng]);
    }

    const cantCupones = Array.isArray(com.cupones) ? com.cupones.length : 0;
    const cantPubs = Array.isArray(com.publicaciones) ? com.publicaciones.length : 0;
    const waUrl = com.whatsappUrl || formatearWhatsAppUrl(com.telefono || "");

    const card = document.createElement("article");
    card.className = "comercio-card";
    card.innerHTML = `
      <div>
        ${com.fotoFachada
          ? `<img src="${com.fotoFachada}" alt="${escaparHTML(com.nombreComercio)}" class="comercio-card-img">`
          : `<div class="comercio-card-img" style="display:flex; align-items:center; justify-content:center; color:#f3d56b; font-weight:700;">VEA APP</div>`}
        <div class="comercio-card-body">
          <h4 class="comercio-card-titulo">${escaparHTML(com.nombreComercio)}</h4>
          <p class="subtexto">📍 ${escaparHTML(com.direccion || "")}</p>
          ${com.telefono ? `<p class="subtexto">📱 WhatsApp: <strong>${escaparHTML(com.telefono)}</strong></p>` : ""}
          <div class="comercio-badges">
            <span class="badge-vea">🎟️ ${cantCupones} cupón${cantCupones === 1 ? "" : "es"}</span>
            <span class="badge-vea">📰 ${cantPubs} pub${cantPubs === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>
      <div class="comercio-card-acciones">
        <button type="button" class="btn-ver-vidriera">Ver vidriera</button>
        ${waUrl ? `<a href="${escaparHTML(waUrl)}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; padding:8px 12px; border-radius:8px; background:#16a34a; color:#fff; font-weight:700; text-decoration:none; font-size:0.85rem;">WhatsApp</a>` : ""}
      </div>
    `;

    const btnVer = card.querySelector(".btn-ver-vidriera");
    if (btnVer) {
      btnVer.addEventListener("click", () => abrirDetalleComercio(com));
    }

    listaComerciosPublicos.appendChild(card);
  });

  if (mapaPrincipal && limites.length > 1) {
    mapaPrincipal.fitBounds(limites, { padding: [24, 24], maxZoom: 15 });
  } else if (mapaPrincipal && limites.length === 1) {
    mapaPrincipal.setView(limites[0], 15);
  }
}

function filtrarComercios() {
  const termino = (inputBuscarComercio ? inputBuscarComercio.value : "").trim().toLowerCase();
  if (!termino) {
    renderizarComerciosPublicos(comerciosCargados);
    return;
  }

  const filtrados = comerciosCargados.filter((com) => {
    const textoCupones = (com.cupones || []).map((c) => `${c.titulo || ""} ${c.codigo || ""}`).join(" ");
    const textoPubs = (com.publicaciones || []).map((p) => `${p.titulo || ""} ${p.descripcion || ""}`).join(" ");
    const campoCompleto = `${com.nombreComercio || ""} ${com.direccion || ""} ${com.telefono || ""} ${textoCupones} ${textoPubs}`.toLowerCase();
    return campoCompleto.includes(termino);
  });

  renderizarComerciosPublicos(filtrados);
}

if (inputBuscarComercio) {
  inputBuscarComercio.addEventListener("input", filtrarComercios);
}

if (btnLimpiarBusqueda) {
  btnLimpiarBusqueda.addEventListener("click", () => {
    if (inputBuscarComercio) inputBuscarComercio.value = "";
    renderizarComerciosPublicos(comerciosCargados);
  });
}

if (btnCerrarDetalleComercio && detalleComercioPublico) {
  btnCerrarDetalleComercio.addEventListener("click", () => {
    detalleComercioPublico.classList.add("hidden");
  });
}

db.collection("comercios").onSnapshot((snapshot) => {
  comerciosCargados = [];
  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    if (data.nombreComercio) {
      comerciosCargados.push({ id: doc.id, ...data });
    }
  });
  filtrarComercios();
}, (err) => {
  console.error("Error leyendo comercios públicos:", err);
  if (contadorComercios) {
    contadorComercios.textContent = "No se pudieron cargar los comercios.";
  }
});

inicializarMapaPrincipal();
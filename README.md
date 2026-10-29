[README.md](https://github.com/user-attachments/files/34147605/README.md)
# veaapp-1e
vidrieras electronicas argentinas 
# V.E.A. — versión corregida 3

Esta versión corrige parte del flujo del panel comercial y añade ubicación geográfica para clientes y comercios.

## Cambios incluidos

- Evita crear un segundo documento de comercio cuando ya existe uno con el mismo email de propietario; esto ayuda a que los cambios de nombre se reflejen en la vidriera correcta.
- Evita pisar campos del panel mientras el comerciante los está editando.
- Añade captura de ubicación del comercio desde el dispositivo del comerciante.
- El botón central del mapa solicita permiso para mostrar la ubicación del visitante, dibuja un marcador azul y prioriza vidrieras cercanas.
- Al buscar ubicación del visitante, el mapa muestra comercios con coordenadas válidas dentro de 20 km y ordena las tarjetas por distancia cuando tienen coordenadas.
- Agrega carga reanudable de videos con porcentaje de progreso y muestra el código/detalle de errores de Firebase.
- Añade un aviso visual si una imagen de portada no puede cargarse.

## Cómo instalar en GitHub Pages

1. Hacé una copia de tu `index.html` actual.
2. Reemplazá el `index.html` del repositorio por este archivo.
3. Esperá a que GitHub Pages termine el despliegue.
4. Abrí la web en HTTPS, actualizá con Ctrl+F5 y probá nuevamente.

## Requisitos y límites importantes

- El navegador debe permitir la geolocalización. En la web publicada debe usarse HTTPS y el visitante debe aceptar el permiso.
- Para que un comercio aparezca cerca del visitante, necesita coordenadas guardadas. En el panel, el comerciante debe pulsar **Guardar ubicación exacta del comercio** y después **Guardar y Actualizar en la Nube**. Esto captura la ubicación del dispositivo donde se encuentra el comercio; debe hacerse físicamente en el local.
- Las cargas de imágenes y videos dependen de que Firebase Storage esté habilitado y de sus reglas de seguridad. Esta versión muestra el código y detalle del error, pero no puede corregir reglas del proyecto sin verlas.
- El proyecto actual sigue usando autenticación local del HTML para el panel. No debe considerarse listo para producción segura hasta migrar a Firebase Authentication y restringir Firestore/Storage con reglas basadas en usuarios autenticados. No se deben abrir las reglas de Storage a escritura pública como solución rápida.
- Los videos grandes pueden tardar; el panel muestra el progreso. Para máxima compatibilidad, probar MP4 con H.264/AAC.

## Prueba recomendada

1. Iniciar sesión como comerciante.
2. Cambiar el nombre del comercio y pulsar guardar; recargar y verificar que el nombre persista.
3. Subir una portada y esperar la confirmación; guardar y verificar la tarjeta pública.
4. Subir un video MP4 de prueba y observar el porcentaje. Si falla, anotar el código y detalle del mensaje.
5. En el dispositivo ubicado en el local, capturar y guardar la ubicación del comercio.
6. En otro navegador/dispositivo, pulsar el botón central del mapa y aceptar la ubicación. Verificar el marcador azul y las vidrieras cercanas.

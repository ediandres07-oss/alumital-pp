/**
 * auth.js — Alumital SAS Authentication Module
 * Handles login, logout, session management
 * Version 3.0.0
 */

(function () {
  'use strict';

  /**
   * Returns the Authorization header object for authenticated API calls.
   * @returns {Object} Header object with Bearer token
   */
  function getAuthHeader() {
    return {
      'Authorization': 'Bearer ' + (sessionStorage.getItem('alumital_token') || '')
    };
  }

  /**
   * Logs the user in with email/password credentials.
   * On success, saves token and user info to sessionStorage and shows the app.
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<boolean>} true if login succeeded
   */
  async function iniciarSesion(email, password) {
    const errorEl = document.getElementById('login-error');
    const btnLogin = document.getElementById('btn-login');

    // Reset error state
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }

    // Disable button while processing
    if (btnLogin) {
      btnLogin.disabled = true;
      btnLogin.textContent = 'Ingresando...';
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      });

      const data = await res.json();

      if (res.ok && data.token) {
        // Save credentials
        sessionStorage.setItem('alumital_token', data.token);
        sessionStorage.setItem('alumital_usuario', JSON.stringify(data.user || { nombre: email, rol: 'usuario' }));

        // Update UI with user info
        _actualizarInfoUsuario(data.user || { nombre: email, rol: 'usuario' });

        // Show app, hide login
        _mostrarApp();

        return true;
      } else {
        // Show error message
        const mensaje = data.error || data.message || 'Credenciales inválidas. Intenta de nuevo.';
        _mostrarErrorLogin(mensaje);
        return false;
      }
    } catch (err) {
      console.error('[Auth] Error de conexión:', err);
      _mostrarErrorLogin('Error de conexión con el servidor. Verifica que el backend esté corriendo.');
      return false;
    } finally {
      // Re-enable button
      if (btnLogin) {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Iniciar Sesión';
      }
    }
  }

  /**
   * Logs the user out. Clears session and shows login screen.
   */
  async function cerrarSesion() {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      });
    } catch (err) {
      console.warn('[Auth] Error al cerrar sesión en servidor:', err);
    }

    // Always clear local session regardless of server response
    sessionStorage.removeItem('alumital_token');
    sessionStorage.removeItem('alumital_usuario');

    // Show login, hide app
    _mostrarLogin();
  }

  /**
   * Verifies the current session token against the server.
   * @returns {Promise<boolean>} true if session is valid
   */
  async function verificarSesion() {
    const token = sessionStorage.getItem('alumital_token');

    if (!token) {
      _mostrarLogin();
      return false;
    }

    try {
      const res = await fetch('/api/session', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      });

      if (res.ok) {
        const data = await res.json();
        const usuario = data.user || JSON.parse(sessionStorage.getItem('alumital_usuario') || '{}');
        _actualizarInfoUsuario(usuario);
        _mostrarApp();
        return true;
      } else {
        // Token expired or invalid
        sessionStorage.removeItem('alumital_token');
        sessionStorage.removeItem('alumital_usuario');
        _mostrarLogin();
        return false;
      }
    } catch (err) {
      console.warn('[Auth] No se pudo verificar la sesión:', err);
      // If server is unreachable but we have a token, show app anyway
      // This allows offline-ish usage
      const usuario = JSON.parse(sessionStorage.getItem('alumital_usuario') || '{}');
      if (usuario.nombre) {
        _actualizarInfoUsuario(usuario);
        _mostrarApp();
        return true;
      }
      _mostrarLogin();
      return false;
    }
  }

  // ========================
  // Internal helper functions
  // ========================

  /**
   * Shows the login screen and hides the main app.
   */
  function _mostrarLogin() {
    const loginScreen = document.getElementById('login-screen');
    const appMain = document.getElementById('app-main');

    if (loginScreen) loginScreen.style.display = 'flex';
    if (appMain) appMain.style.display = 'none';

    // Clear password field for security
    const passInput = document.getElementById('login-password');
    if (passInput) passInput.value = '';
  }

  /**
   * Shows the main app and hides the login screen.
   */
  function _mostrarApp() {
    const loginScreen = document.getElementById('login-screen');
    const appMain = document.getElementById('app-main');

    if (loginScreen) loginScreen.style.display = 'none';
    if (appMain) appMain.style.display = 'flex';
  }

  /**
   * Updates the user display elements in the sidebar.
   * @param {Object} usuario - User object with nombre and rol properties
   */
  function _actualizarInfoUsuario(usuario) {
    const displayName = document.getElementById('user-display-name');
    const displayRol = document.getElementById('user-display-rol');
    const avatar = document.getElementById('user-avatar');

    const nombre = usuario.nombre || usuario.name || usuario.email || 'Usuario';
    const rol = usuario.rol || usuario.role || 'Usuario';

    if (displayName) displayName.textContent = nombre;
    if (displayRol) displayRol.textContent = rol;
    if (avatar) avatar.textContent = nombre.charAt(0).toUpperCase();
  }

  /**
   * Shows an error message on the login screen.
   * @param {string} mensaje - Error message to display
   */
  function _mostrarErrorLogin(mensaje) {
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
      errorEl.textContent = mensaje;
      errorEl.style.display = 'block';
    }
  }

  /**
   * Switches the HTML5 video playing in the login screen background.
   * @param {string} videoUrl - Direct MP4 Video URL
   * @param {HTMLElement} btn - Button element that was clicked
   */
  function switchLoginVideo(videoUrl, btn) {
    const video = document.getElementById('login-video');
    const source = document.getElementById('login-video-source');
    if (video && source) {
      source.src = videoUrl;
      video.load();
      video.play().catch(function(err) {
        console.warn('[Video] Play blocked:', err);
      });
    }
    
    // Update active class on switcher buttons
    const buttons = document.querySelectorAll('.switcher-btn');
    buttons.forEach(function (b) {
      b.classList.remove('active');
    });
    if (btn) {
      btn.classList.add('active');
    }
  }

  // ========================
  // Initialize on page load
  // ========================
  document.addEventListener('DOMContentLoaded', function () {
    verificarSesion();
  });

  // ========================
  // Export to window
  // ========================
  window.iniciarSesion = iniciarSesion;
  window.cerrarSesion = cerrarSesion;
  window.verificarSesion = verificarSesion;
  window.getAuthHeader = getAuthHeader;
  window.switchLoginVideo = switchLoginVideo;

})();

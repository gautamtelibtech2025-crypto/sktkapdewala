// API Configuration
const API_BASE = 'http://localhost:3000/api';
const SESSION_ID = (() => {
  let id = localStorage.getItem('skt_session');
  if (!id) { id = 'sess_' + Math.random().toString(36).slice(2); localStorage.setItem('skt_session', id); }
  return id;
})();

// State
const State = {
  user: JSON.parse(localStorage.getItem('skt_user') || 'null'),
  token: localStorage.getItem('skt_token') || null,
  cartCount: 0,
  storeMode: localStorage.getItem('skt_store') || 'SktCommerce',

  setUser(user, token) {
    this.user = user;
    this.token = token;
    localStorage.setItem('skt_user', JSON.stringify(user));
    localStorage.setItem('skt_token', token);
    document.dispatchEvent(new CustomEvent('authChange', { detail: { user, token } }));
  },

  logout() {
    this.user = null;
    this.token = null;
    localStorage.removeItem('skt_user');
    localStorage.removeItem('skt_token');
    document.dispatchEvent(new CustomEvent('authChange', { detail: null }));
  },

  setStore(mode) {
    this.storeMode = mode;
    localStorage.setItem('skt_store', mode);
    document.dispatchEvent(new CustomEvent('storeChange', { detail: mode }));
  }
};

// API Client
const API = {
  async request(method, path, body = null, isFormData = false) {
    const headers = { 'x-session-id': SESSION_ID };
    if (State.token) headers['Authorization'] = `Bearer ${State.token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const options = { method, headers };
    if (body) options.body = isFormData ? body : JSON.stringify(body);

    try {
      const res = await fetch(API_BASE + path, options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');
      return data;
    } catch (err) {
      throw err;
    }
  },

  get: (path) => API.request('GET', path),
  post: (path, body) => API.request('POST', path, body),
  put: (path, body) => API.request('PUT', path, body),
  delete: (path, body) => API.request('DELETE', path, body),
  postForm: (path, form) => API.request('POST', path, form, true),

  // Auth
  auth: {
    register: (d) => API.post('/auth/register', d),
    login: (d) => API.post('/auth/login', d),
    sendOTP: (phone) => API.post('/auth/otp/send', { phone }),
    verifyOTP: (d) => API.post('/auth/otp/verify', d),
    me: () => API.get('/auth/me'),
  },

  // Products
  products: {
    list: (params = {}) => API.get('/products?' + new URLSearchParams(params)),
    get: (id) => API.get(`/products/${id}`),
    categories: () => API.get('/products/categories'),
    create: (form) => API.postForm('/products', form),
    update: (id, d) => API.put(`/products/${id}`, d),
    delete: (id) => API.delete(`/products/${id}`),
  },

  // Inventory
  inventory: {
    list: (params = {}) => API.get('/inventory?' + new URLSearchParams(params)),
    set: (d) => API.post('/inventory', d),
    stores: () => API.get('/inventory/stores'),
  },

  // Cart
  cart: {
    get: () => API.get('/cart'),
    add: (d) => API.post('/cart/add', d),
    remove: (d) => API.delete('/cart/remove', d),
    update: (d) => API.put('/cart/update', d),
  },

  // Orders
  orders: {
    create: (d) => API.post('/orders', d),
    list: () => API.get('/orders'),
    updateStatus: (d) => API.put('/orders/status', d),
  },

  // Admin
  admin: {
    dashboard: () => API.get('/admin/dashboard'),
    users: (params = {}) => API.get('/admin/users?' + new URLSearchParams(params)),
    stores: () => API.get('/admin/stores'),
    settings: () => API.get('/admin/settings'),
    updateSetting: (d) => API.post('/admin/settings', d),
    upload: (form) => API.postForm('/admin/upload', form),
  }
};

// Toast notifications
const Toast = {
  container: null,
  init() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(message, type = 'info', duration = 3000) {
    if (!this.container) this.init();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success: (msg) => Toast.show(msg, 'success'),
  error: (msg) => Toast.show(msg, 'error'),
  info: (msg) => Toast.show(msg, 'info'),
};

// Cart count updater
async function updateCartCount() {
  try {
    const data = await API.cart.get();
    const count = data.data?.cart?.items?.length || 0;
    State.cartCount = count;
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  } catch {}
}

// Format currency
const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

// Format date
const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

window.API = API;
window.State = State;
window.Toast = Toast;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.updateCartCount = updateCartCount;

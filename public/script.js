// ============================================
// GYM PRO - PREMIUM DASHBOARD JAVASCRIPT
// ============================================

// State Management
const state = {
    clients: [],
    currentPage: 1,
    itemsPerPage: 9,
    currentFilter: 'all',
    searchQuery: '',
    darkMode: localStorage.getItem('darkMode') === 'true'
};

// DOM Elements
const elements = {
    clientGrid: document.getElementById('clientGrid'),
    totalCount: document.getElementById('totalCount'),
    paidCount: document.getElementById('paidCount'),
    unpaidCount: document.getElementById('unpaidCount'),
    expiredCount: document.getElementById('expiredCount'),
    searchInput: document.getElementById('searchInput'),
    themeToggle: document.getElementById('themeToggle'),
    sidebar: document.getElementById('sidebar'),
    menuToggle: document.getElementById('menuToggle'),
    closeSidebar: document.getElementById('closeSidebar'),
    formContainer: document.getElementById('formContainer'),
    collapseForm: document.getElementById('collapseForm'),
    photoInput: document.getElementById('photoInput'),
    uploadArea: document.getElementById('uploadArea'),
    preview: document.getElementById('preview'),
    uploadPlaceholder: document.getElementById('uploadPlaceholder'),
    removePhoto: document.getElementById('removePhoto'),
    addClientBtn: document.getElementById('addClientBtn'),
    clearForm: document.getElementById('clearForm'),
    toastContainer: document.getElementById('toastContainer'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    modal: document.getElementById('clientModal'),
    modalBody: document.getElementById('modalBody'),
    modalClose: document.getElementById('modalClose')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    setCurrentDate();
    loadTheme();
    setupEventListeners();
    loadClients();
    setupDragAndDrop();
}

// Set Current Date
function setCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', options);
}

// Theme Management
function loadTheme() {
    if (state.darkMode) {
        document.body.setAttribute('data-theme', 'dark');
        elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.setAttribute('data-theme', 'light');
        elements.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    state.darkMode = !state.darkMode;
    localStorage.setItem('darkMode', state.darkMode);
    loadTheme();
}

// Event Listeners
function setupEventListeners() {
    // Theme Toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Sidebar Toggle
    elements.menuToggle.addEventListener('click', () => {
        elements.sidebar.classList.add('active');
    });
    
    elements.closeSidebar.addEventListener('click', () => {
        elements.sidebar.classList.remove('active');
    });
    
    // Form Collapse
    elements.collapseForm.addEventListener('click', () => {
        elements.formContainer.classList.toggle('collapsed');
        elements.collapseForm.innerHTML = elements.formContainer.classList.contains('collapsed') 
            ? '<i class="fas fa-chevron-down"></i>' 
            : '<i class="fas fa-chevron-up"></i>';
    });
    
    // Photo Upload
    elements.uploadArea.addEventListener('click', () => elements.photoInput.click());
    elements.photoInput.addEventListener('change', handlePhotoSelect);
    elements.removePhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        clearPhoto();
    });
    
    // Form Actions
    elements.addClientBtn.addEventListener('click', addClient);
    elements.clearForm.addEventListener('click', clearForm);
    
    // Search
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // Filter Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.currentFilter = tab.dataset.filter;
            state.currentPage = 1;
            renderClients();
        });
    });
    
    // Pagination
    elements.prevPage.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderClients();
        }
    });
    
    elements.nextPage.addEventListener('click', () => {
        const totalPages = Math.ceil(getFilteredClients().length / state.itemsPerPage);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            renderClients();
        }
    });
    
    // Modal
    elements.modalClose.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

// Drag and Drop
function setupDragAndDrop() {
    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });
    
    elements.uploadArea.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('dragover');
    });
    
    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length) {
            elements.photoInput.files = files;
            handlePhotoSelect({ target: elements.photoInput });
        }
    });
}

// Photo Handling
function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('File size should be less than 5MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        elements.preview.src = event.target.result;
        elements.preview.hidden = false;
        elements.uploadPlaceholder.hidden = true;
        elements.removePhoto.hidden = false;
    };
    reader.readAsDataURL(file);
}

function clearPhoto() {
    elements.photoInput.value = '';
    elements.preview.src = '';
    elements.preview.hidden = true;
    elements.uploadPlaceholder.hidden = false;
    elements.removePhoto.hidden = true;
}

// Client Management
async function loadClients() {
    showSkeleton();
    
    try {
        const res = await fetch('/api/clients');
        if (!res.ok) throw new Error('Failed to load clients');
        
        const data = await res.json();  // ✅ Pehle data mein lo
        
        // ✅ Yeh line change karo:
        state.clients = data.clients || [];  // Sirf array nikalo, agar nahi hai toh empty array
        
        // ✅ Check karo ki array hai
        if (!Array.isArray(state.clients)) {
            throw new Error('Invalid data format');
        }
        
        updateStats();
        renderClients();
    } catch (err) {
        showToast('Failed to load clients', 'error');
        console.error(err);
        state.clients = []; // ✅ Error mein empty array set karo
    }
}

function showSkeleton() {
    elements.clientGrid.innerHTML = `
        <div class="skeleton-loader">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        </div>
    `;
}

function updateStats() {
    const today = new Date();
    
    const stats = state.clients.reduce((acc, client) => {
        acc.total++;
        
        const expiry = new Date(client.expiryDate);
        
        if (expiry < today) {
            acc.expired++;
        } else if (client.feeStatus === 'Paid') {
            acc.paid++;
        } else {
            acc.unpaid++;
        }
        
        return acc;
    }, { total: 0, paid: 0, unpaid: 0, expired: 0 });
    
    // Animate numbers
    animateNumber(elements.totalCount, stats.total);
    animateNumber(elements.paidCount, stats.paid);
    animateNumber(elements.unpaidCount, stats.unpaid);
    animateNumber(elements.expiredCount, stats.expired);
}

function animateNumber(element, target) {
    const duration = 1000;
    const start = parseInt(element.textContent) || 0;
    const increment = (target - start) / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, 16);
}

function getFilteredClients() {
    let filtered = state.clients;
    
    // Search filter
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(c => 
            c.name.toLowerCase().includes(query) || 
            c.phone.includes(query)
        );
    }
    
    // Status filter
    const today = new Date();
    
    switch (state.currentFilter) {
        case 'paid':
            return filtered.filter(c => {
                const expiry = new Date(c.expiryDate);
                return c.feeStatus === 'Paid' && expiry >= today;
            });
        case 'unpaid':
            return filtered.filter(c => {
                const expiry = new Date(c.expiryDate);
                return c.feeStatus !== 'Paid' && expiry >= today;
            });
        case 'expired':
            return filtered.filter(c => {
                const expiry = new Date(c.expiryDate);
                return expiry < today;
            });
        default:
            return filtered;
    }
}

function renderClients() {
    const filtered = getFilteredClients();
    const totalPages = Math.ceil(filtered.length / state.itemsPerPage);
    const start = (state.currentPage - 1) * state.itemsPerPage;
    const paginated = filtered.slice(start, start + state.itemsPerPage);
    
    // Update pagination
    elements.currentPage.textContent = state.currentPage;
    elements.totalPages.textContent = totalPages || 1;
    elements.prevPage.disabled = state.currentPage === 1;
    elements.nextPage.disabled = state.currentPage >= totalPages;
    
    if (paginated.length === 0) {
        elements.clientGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary);">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>No clients found</p>
            </div>
        `;
        return;
    }
    
    elements.clientGrid.innerHTML = paginated.map(client => createClientCard(client)).join('');
    
    // Attach events
    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', () => toggleFee(btn.dataset.id));
    });
    
    document.querySelectorAll('.btn-renew').forEach(btn => {
        btn.addEventListener('click', () => renewClient(btn.dataset.id));
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteClient(btn.dataset.id));
    });
    
    document.querySelectorAll('.client-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                showClientModal(card.dataset.id);
            }
        });
    });
}

function createClientCard(client) {
    const today = new Date();
    const expiry = new Date(client.expiryDate);
    
    let statusClass, statusText;
    
    if (expiry < today) {
        statusClass = 'status-expired';
        statusText = 'Expired';
    } else if (client.feeStatus === 'Paid') {
        statusClass = 'status-paid';
        statusText = 'Active';
    } else {
        statusClass = 'status-unpaid';
        statusText = 'Pending';
    }
    
    const photoUrl = client.photo || 'https://via.placeholder.com/300?text=No+Photo';
    
    return `
        <div class="client-card fade-in" data-id="${client._id}">
            <div class="client-image">
                <img src="${photoUrl}" alt="${client.name}" loading="lazy">
                <span class="client-status ${statusClass}">${statusText}</span>
            </div>
            <div class="client-info">
                <h3>${client.name}</h3>
                <div class="client-meta">
                    <span><i class="fas fa-phone"></i> ${client.phone}</span>
                    <span><i class="fas fa-calendar-alt"></i> Joined: ${formatDate(client.joinDate)}</span>
                    <span><i class="fas fa-hourglass-end"></i> Expires: ${formatDate(client.expiryDate)}</span>
                </div>
                <div class="client-actions">
                    <button class="btn-toggle" data-id="${client._id}">
                        <i class="fas fa-exchange-alt"></i> Toggle
                    </button>
                    <button class="btn-renew" data-id="${client._id}">
                        <i class="fas fa-sync"></i> Renew
                    </button>
                    <button class="btn-delete" data-id="${client._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Client Actions
async function addClient() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const joinDate = document.getElementById('joinDate').value;
    const duration = parseInt(document.getElementById('duration').value);
    const photo = elements.photoInput.files[0];
    
    if (!name || !phone || !joinDate) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    // Calculate expiry date
    const join = new Date(joinDate);
    const expiry = new Date(join);
    expiry.setMonth(expiry.getMonth() + duration);
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('joinDate', joinDate);
    formData.append('expiryDate', expiry.toISOString().split('T')[0]);
    if (photo) formData.append('photo', photo);
    
    try {
        elements.addClientBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        elements.addClientBtn.disabled = true;
        
        const res = await fetch('/api/clients', {
            method: 'POST',
            body: formData
        });
        
        if (!res.ok) throw new Error('Failed to add client');
        
        showToast('Client added successfully', 'success');
        clearForm();
        loadClients();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.addClientBtn.innerHTML = '<i class="fas fa-plus"></i> Add Client';
        elements.addClientBtn.disabled = false;
    }
}

async function toggleFee(id) {
    try {
        const res = await fetch(`/api/clients/${id}/toggle-fee`, { method: 'PUT' });
        if (!res.ok) throw new Error('Failed to toggle fee');
        
        showToast('Fee status updated', 'success');
        loadClients();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renewClient(id) {
    const months = prompt('Enter renewal period (months):', '1');
    if (!months || isNaN(months)) return;
    
    try {
        const res = await fetch(`/api/clients/${id}/renew`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ months: parseInt(months) })
        });
        
        if (!res.ok) throw new Error('Failed to renew');
        
        showToast('Membership renewed', 'success');
        loadClients();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteClient(id) {
    if (!confirm('Are you sure you want to delete this client?')) return;
    
    try {
        const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        
        showToast('Client deleted', 'success');
        loadClients();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Form Management
function clearForm() {
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('joinDate').value = '';
    document.getElementById('duration').value = '12';
    clearPhoto();
}

function handleSearch(e) {
    state.searchQuery = e.target.value;
    state.currentPage = 1;
    renderClients();
}

// Modal
function showClientModal(id) {
    const client = state.clients.find(c => c._id === id);
    if (!client) return;
    
    elements.modalBody.innerHTML = `
        <div style="text-align: center; margin-bottom: 24px;">
            <img src="${client.photo || 'https://via.placeholder.com/150'}" 
                 style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; margin-bottom: 16px;">
            <h2>${client.name}</h2>
            <p style="color: var(--text-secondary);">${client.phone}</p>
        </div>
        <div style="display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-dark); border-radius: 8px;">
                <span>Join Date</span>
                <strong>${formatDate(client.joinDate)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-dark); border-radius: 8px;">
                <span>Expiry Date</span>
                <strong>${formatDate(client.expiryDate)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-dark); border-radius: 8px;">
                <span>Fee Status</span>
                <strong style="color: ${client.feeStatus === 'Paid' ? 'var(--success)' : 'var(--warning)'}">${client.feeStatus}</strong>
            </div>
        </div>
    `;
    
    elements.modal.classList.add('active');
}

function closeModal() {
    elements.modal.classList.remove('active');
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check' : type === 'error' ? 'times' : 'exclamation';
    const title = type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Warning';
    
    toast.innerHTML = `
        <div class="toast-icon"><i class="fas fa-${icon}"></i></div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Utility Functions
function formatDate(dateString) {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function logout() {
    try {
        await fetch('/api/logout');
        window.location.href = '/';
    } catch (err) {
        console.error('Logout failed:', err);
    }
}
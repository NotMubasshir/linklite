/**
 * LinkLite - Production Web Application Core Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- State Management ---
  let users = JSON.parse(localStorage.getItem('linklite_users')) || [];
  let currentUser = JSON.parse(localStorage.getItem('linklite_current_user')) || null;
  let links = JSON.parse(localStorage.getItem('linklite_links')) || [];
  
  let clicksChartInstance = null;
  let referrerChartInstance = null;

  // --- Client-Side Routing for Hash Redirects ---
  if (window.location.hash) {
    const hashVal = window.location.hash.substring(1);
    // Ignore internal navigation anchors
    if (!['hero', 'dashboard', 'analytics'].includes(hashVal)) {
      const matchedLink = links.find(l => l.alias === hashVal);
      if (matchedLink) {
        registerClick(matchedLink.id);
        window.location.href = matchedLink.originalUrl;
        return;
      }
    }
  }

  // --- DOM Elements ---
  const shortenForm = document.getElementById('shortenForm');
  const longUrlInput = document.getElementById('longUrlInput');
  const customAliasInput = document.getElementById('customAlias');
  const expirationDateInput = document.getElementById('expirationDate');
  const passwordProtectInput = document.getElementById('passwordProtect');
  
  const resultCard = document.getElementById('resultCard');
  const resultShortUrl = document.getElementById('resultShortUrl');
  const resultOriginalUrl = document.getElementById('resultOriginalUrl');
  const copyResultBtn = document.getElementById('copyResultBtn');
  const openResultLink = document.getElementById('openResultLink');
  const qrcodeContainer = document.getElementById('qrcode');
  const downloadQrBtn = document.getElementById('downloadQrBtn');
  
  const linksTableBody = document.getElementById('linksTableBody');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const sortSelect = document.getElementById('sortSelect');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const dropZone = document.getElementById('dropZone');

  // Auth Elements
  const openAuthBtn = document.getElementById('openAuthBtn');
  const authModal = document.getElementById('authModal');
  const closeAuthModal = document.getElementById('closeAuthModal');
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loggedOutNav = document.getElementById('loggedOutNav');
  const loggedInNav = document.getElementById('loggedInNav');
  const userGreeting = document.getElementById('userGreeting');
  const logoutBtn = document.getElementById('logoutBtn');

  // --- Theme Controller ---
  const initTheme = () => {
    const savedTheme = localStorage.getItem('linklite_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  };

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('linklite_theme', newTheme);
    renderCharts();
  });

  // --- Auth System Logic ---
  function updateAuthUI() {
    if (currentUser) {
      loggedOutNav.classList.add('hidden');
      loggedInNav.classList.remove('hidden');
      userGreeting.textContent = `@${currentUser.username}`;
    } else {
      loggedOutNav.classList.remove('hidden');
      loggedInNav.classList.add('hidden');
      userGreeting.textContent = '';
    }
  }

  openAuthBtn.addEventListener('click', () => authModal.classList.remove('hidden'));
  closeAuthModal.addEventListener('click', () => authModal.classList.add('hidden'));

  tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  });

  tabRegisterBtn.addEventListener('click', () => {
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  });

  // User Registration (Ensuring UNIQUE email & username)
  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim().toLowerCase();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;

    const emailExists = users.some(u => u.email === email);
    const usernameExists = users.some(u => u.username === username);

    if (emailExists) {
      showToast('Error: This email is already registered.');
      return;
    }
    if (usernameExists) {
      showToast('Error: This username is already taken.');
      return;
    }

    const newUser = { id: Date.now().toString(), username, email, password };
    users.push(newUser);
    localStorage.setItem('linklite_users', JSON.stringify(users));

    currentUser = { id: newUser.id, username: newUser.username, email: newUser.email };
    localStorage.setItem('linklite_current_user', JSON.stringify(currentUser));

    updateAuthUI();
    renderDashboard();
    renderCharts();
    authModal.classList.add('hidden');
    registerForm.reset();
    showToast(`Account created! Welcome @${newUser.username}`);
  });

  // User Login
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const identifier = document.getElementById('loginIdentifier').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    const matchedUser = users.find(u => (u.email === identifier || u.username === identifier) && u.password === password);

    if (!matchedUser) {
      showToast('Invalid credentials. Please try again.');
      return;
    }

    currentUser = { id: matchedUser.id, username: matchedUser.username, email: matchedUser.email };
    localStorage.setItem('linklite_current_user', JSON.stringify(currentUser));

    updateAuthUI();
    renderDashboard();
    renderCharts();
    authModal.classList.add('hidden');
    loginForm.reset();
    showToast(`Signed in as @${matchedUser.username}`);
  });

  // User Logout
  logoutBtn.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('linklite_current_user');
    updateAuthUI();
    renderDashboard();
    renderCharts();
    showToast('Logged out successfully');
  });

  // Helper to filter links by user scope
  function getUserLinks() {
    if (!currentUser) return links;
    return links.filter(l => l.userId === currentUser.id);
  }

  // --- URL Shortening Logic ---
  shortenForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const originalUrl = longUrlInput.value.trim();
    if (!originalUrl) return;

    const customAlias = customAliasInput.value.trim();
    const expiration = expirationDateInput.value;
    const password = passwordProtectInput.value;

    if (customAlias && links.some(l => l.alias === customAlias)) {
      showToast('Custom alias is already in use.');
      return;
    }

    const alias = customAlias || generateAlias();
    const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
    const shortUrl = `${baseUrl}#${alias}`;

    const newLink = {
      id: Date.now().toString(),
      userId: currentUser ? currentUser.id : null,
      originalUrl,
      alias,
      shortUrl,
      createdAt: new Date().toISOString(),
      expiration: expiration || null,
      password: password || null,
      clicks: 0,
      isFavorite: false,
      referrers: { Direct: 0, Google: 0, Twitter: 0, LinkedIn: 0 }
    };

    links.unshift(newLink);
    saveLinks();
    renderResult(newLink);
    renderDashboard();
    renderCharts();

    shortenForm.reset();
    showToast('URL shortened successfully!');
  });

  function generateAlias() {
    return Math.random().toString(36).substring(2, 8);
  }

  function renderResult(link) {
    resultShortUrl.value = link.shortUrl;
    resultOriginalUrl.textContent = link.originalUrl;
    openResultLink.href = link.shortUrl;
    
    qrcodeContainer.innerHTML = '';
    new QRCode(qrcodeContainer, {
      text: link.shortUrl,
      width: 100,
      height: 100,
      colorDark: "#111827",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });

    resultCard.classList.remove('hidden');
    resultCard.scrollIntoView({ behavior: 'smooth' });
  }

  // --- Clipboard Action ---
  copyResultBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(resultShortUrl.value);
    copyResultBtn.textContent = 'Copied!';
    setTimeout(() => { copyResultBtn.textContent = 'Copy'; }, 2000);
    showToast('Copied to clipboard');
  });

  // --- Download QR Code ---
  downloadQrBtn.addEventListener('click', () => {
    const img = qrcodeContainer.querySelector('img');
    if (img && img.src) {
      const a = document.createElement('a');
      a.href = img.src;
      a.download = 'linklite-qr.png';
      a.click();
    }
  });

  // --- Dashboard Renderer ---
  function renderDashboard() {
    const activeUserLinks = getUserLinks();

    const totalLinks = activeUserLinks.length;
    const totalClicks = activeUserLinks.reduce((sum, l) => sum + l.clicks, 0);
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayClicks = activeUserLinks
      .filter(l => l.createdAt.startsWith(todayStr))
      .reduce((sum, l) => sum + l.clicks, 0);
      
    const activeLinks = activeUserLinks.filter(l => !isExpired(l.expiration)).length;

    document.getElementById('metricTotalLinks').textContent = totalLinks;
    document.getElementById('metricTotalClicks').textContent = totalClicks;
    document.getElementById('metricTodayClicks').textContent = todayClicks;
    document.getElementById('metricActiveLinks').textContent = activeLinks;

    let filtered = [...activeUserLinks];

    const query = searchInput.value.toLowerCase();
    if (query) {
      filtered = filtered.filter(l => 
        l.originalUrl.toLowerCase().includes(query) || 
        l.alias.toLowerCase().includes(query)
      );
    }

    const status = statusFilter.value;
    if (status === 'active') filtered = filtered.filter(l => !isExpired(l.expiration));
    if (status === 'expired') filtered = filtered.filter(l => isExpired(l.expiration));
    if (status === 'favorite') filtered = filtered.filter(l => l.isFavorite);

    const sort = sortSelect.value;
    if (sort === 'newest') filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sort === 'oldest') filtered.sort((a, b) => new Date(a.createdAt) - new Date(a.createdAt));
    if (sort === 'clicks') filtered.sort((a, b) => b.clicks - a.clicks);

    linksTableBody.innerHTML = '';
    
    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      filtered.forEach(link => {
        const tr = document.createElement('tr');
        const expired = isExpired(link.expiration);

        tr.innerHTML = `
          <td>
            <a href="${link.shortUrl}" target="_blank" onclick="registerClick('${link.id}')" style="font-weight: 600;">/${link.alias}</a>
          </td>
          <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${link.originalUrl}
          </td>
          <td>${link.clicks}</td>
          <td>
            <span class="badge ${expired ? 'badge-danger' : 'badge-success'}">
              ${expired ? 'Expired' : 'Active'}
            </span>
          </td>
          <td>${new Date(link.createdAt).toLocaleDateString()}</td>
          <td class="text-right">
            <button class="btn btn-secondary btn-sm" onclick="copyLink('${link.shortUrl}')">Copy</button>
            <button class="btn btn-secondary btn-sm" onclick="deleteLink('${link.id}')">Delete</button>
          </td>
        `;
        linksTableBody.appendChild(tr);
      });
    }
  }

  function isExpired(expirationDate) {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  }

  // --- Global Window Helpers ---
  window.registerClick = (id) => {
    const link = links.find(l => l.id === id);
    if (link) {
      link.clicks += 1;
      if (!link.referrers) {
        link.referrers = { Direct: 0, Google: 0, Twitter: 0, LinkedIn: 0 };
      }
      link.referrers.Direct = (link.referrers.Direct || 0) + 1;
      saveLinks();
      renderDashboard();
      renderCharts();
    }
  };

  window.copyLink = (url) => {
    navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard');
  };

  window.deleteLink = (id) => {
    links = links.filter(l => l.id !== id);
    saveLinks();
    renderDashboard();
    renderCharts();
    showToast('Link deleted');
  };

  // --- Filtering Listeners ---
  searchInput.addEventListener('input', renderDashboard);
  statusFilter.addEventListener('change', renderDashboard);
  sortSelect.addEventListener('change', renderDashboard);

  // --- Drag and Drop ---
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const droppedText = e.dataTransfer.getData('text');
    if (droppedText && isValidUrl(droppedText)) {
      longUrlInput.value = droppedText;
    }
  });

  function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  // --- Export CSV ---
  exportCsvBtn.addEventListener('click', () => {
    const activeUserLinks = getUserLinks();
    if (activeUserLinks.length === 0) {
      showToast('No data available to export.');
      return;
    }
    const headers = ['Alias,Short URL,Original URL,Clicks,Created At\n'];
    const rows = activeUserLinks.map(l => `"${l.alias}","${l.shortUrl}","${l.originalUrl}",${l.clicks},"${l.createdAt}"`);
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'linklite-export.csv';
    a.click();
    showToast('Exported links as CSV');
  });

  // --- Real-Data Analytics Charts ---
  function renderCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#9CA3AF' : '#6B7280';
    const gridColor = isDark ? '#1F2937' : '#E5E7EB';

    const activeUserLinks = getUserLinks();

    const referrerTotals = { Direct: 0, Google: 0, Twitter: 0, LinkedIn: 0 };
    activeUserLinks.forEach(link => {
      if (link.referrers) {
        Object.keys(referrerTotals).forEach(key => {
          referrerTotals[key] += link.referrers[key] || 0;
        });
      }
    });

    const clicksCtx = document.getElementById('clicksChart').getContext('2d');
    if (clicksChartInstance) clicksChartInstance.destroy();

    const totalClicks = activeUserLinks.reduce((sum, l) => sum + l.clicks, 0);

    clicksChartInstance = new Chart(clicksCtx, {
      type: 'line',
      data: {
        labels: ['Total Stored Links', 'Total Active Clicks'],
        datasets: [{
          label: 'Count',
          data: [activeUserLinks.length, totalClicks],
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
        }
      }
    });

    const refCtx = document.getElementById('referrerChart').getContext('2d');
    if (referrerChartInstance) referrerChartInstance.destroy();

    referrerChartInstance = new Chart(refCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(referrerTotals),
        datasets: [{
          data: Object.values(referrerTotals),
          backgroundColor: ['#2563EB', '#16A34A', '#F59E0B', '#8B5CF6']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor } }
        }
      }
    });
  }

  // --- Local Storage Helpers ---
  function saveLinks() {
    localStorage.setItem('linklite_links', JSON.stringify(links));
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // --- Initial Execution ---
  initTheme();
  updateAuthUI();
  renderDashboard();
  renderCharts();
});
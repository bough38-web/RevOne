
// Default Data Template
const MASTER_CSV = `지사명,구역코드,담당자명,신규목표,해지목표,휴대폰뒷자리
중앙지사,G000103,김의겸,50,2,0000
중앙지사,G000203,최용호,40,3,1234
중앙지사,G000401,송민철,50,1,0000
중앙지사,G000402,김병조,30,0,0000
중앙지사,G000409,미지정,20,0,0000
강북지사,G000101,성진수,60,5,0000
강북지사,G000102,정민석,50,2,5678
서대문지사,G000201,유범식,45,2,0000`;

const app = {
    user: null,
    config: JSON.parse(localStorage.getItem('sa_config')) || { fee: 30, theme: 'light' },
    data: JSON.parse(localStorage.getItem('sa_data')) || [],
    charts: {},

    // --- Init ---
    init: function () {
        if (!this.data.length) this.initData(false);
        this.checkSession();
        this.renderAll();
    },

    checkSession: function () {
        const u = sessionStorage.getItem('sa_user');
        if (u) {
            this.user = JSON.parse(u);
            this.showApp();
        }
    },

    // --- Data Logic ---
    initData: function (alertMsg = true) {
        const lines = MASTER_CSV.split('\n');
        this.data = [];
        for (let i = 1; i < lines.length; i++) {
            const p = lines[i].split(',');
            if (p.length < 3) continue;
            // Generate Realistic Random Data for Demo
            const targetNew = Number(p[3]) || 10;
            this.data.push({
                id: Date.now() + i,
                branch: p[0].trim(),
                manager: p[2].trim(),
                code: p[1].trim(),
                targetNew: targetNew,
                targetCancel: Number(p[4]) || 0,
                phone: p[5] ? p[5].trim() : '0000',

                nc: Math.floor(Math.random() * (targetNew * 1.2)), // 0 ~ 120% achievement
                sub: Math.floor(Math.random() * 10),
                cc: Math.floor(Math.random() * 3),
                sus: Math.floor(Math.random() * 2),
                ret: Math.floor(Math.random() * 5),
                note: ''
            });
        }
        this.save();
        if (alertMsg) this.showToast('Data Initialized with Random Examples', 'success');
        this.renderAll();
    },

    // --- Auth ---
    setLoginMode: function (m) {
        document.querySelectorAll('#loginForms > div').forEach(e => e.style.display = 'none');
        document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active')); // Reset tabs visual
        // Just simple toggle for form visibility
        if (m === 'ADMIN') document.getElementById('formAdmin').style.display = 'block';
        if (m === 'BRANCH') {
            document.getElementById('formBranch').style.display = 'block';
            this.fillBranchSelect('loginBranchSelect');
        }
        if (m === 'STAFF') {
            document.getElementById('formStaff').style.display = 'block';
            this.fillBranchSelect('loginStaffBranch');
        }
    },
    fillBranchSelect: function (id) {
        const brs = [...new Set(this.data.map(d => d.branch))];
        document.getElementById(id).innerHTML = `<option value="">Select Branch</option>` + brs.map(b => `<option>${b}</option>`).join('');
    },
    login: function () {
        // Simplified Logic for Demo
        const adId = document.getElementById('adminId').value;
        const br = document.getElementById('loginBranchSelect').value;
        const stBr = document.getElementById('loginStaffBranch').value;

        if (document.getElementById('formAdmin').style.display === 'block') {
            if (adId === 'admin') this.user = { role: 'ADMIN', name: 'Administrator', branch: 'HQ' };
        } else if (document.getElementById('formBranch').style.display === 'block') {
            if (br) this.user = { role: 'BRANCH', name: br + ' Manager', branch: br };
        } else {
            if (stBr) this.user = { role: 'STAFF', name: 'Staff User', branch: stBr };
        }

        if (this.user) {
            sessionStorage.setItem('sa_user', JSON.stringify(this.user));
            this.showApp();
        } else {
            this.showToast('Please check credentials (admin/1234)', 'error');
        }
    },
    showApp: function () {
        document.getElementById('loginScreen').style.display = 'none';
        document.querySelector('.app-container').style.display = 'flex';
        document.getElementById('uName').innerText = this.user.name;
        document.getElementById('uRole').innerText = this.user.role;
        document.querySelectorAll('.admin-only').forEach(e => e.style.display = this.user.role === 'ADMIN' ? 'flex' : 'none');
        this.renderAll();
    },
    logout: function () {
        sessionStorage.removeItem('sa_user');
        location.reload();
    },

    // --- Render ---
    renderAll: function () {
        if (!this.user) return;
        this.renderStats();
        this.renderCharts();
        this.renderList();
        this.renderTop10();
    },

    renderStats: function () {
        // Aggregate Data
        const sum = k => this.data.reduce((a, b) => a + (b[k] || 0), 0);
        document.getElementById('dNew').innerText = sum('nc').toLocaleString();
        document.getElementById('dSub').innerText = sum('sub').toLocaleString();
        document.getElementById('dSus').innerText = sum('sus').toLocaleString();
        document.getElementById('dCan').innerText = sum('cc').toLocaleString();
        document.getElementById('tNew').innerText = 'Target: ' + sum('targetNew').toLocaleString();
    },

    renderCharts: function () {
        const ctx = (id) => document.getElementById(id).getContext('2d');
        const colors = ['#6c5ce7', '#00b894', '#0984e3', '#fdcb6e', '#e17055', '#d63031'];

        // 1. Trend (Simulated History)
        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const dataHist = labels.map(() => Math.floor(Math.random() * 100) + 50);
        this.createChart('chartTrend', 'line', {
            labels: labels,
            datasets: [{
                label: 'Simulated Trend',
                data: dataHist,
                borderColor: '#6c5ce7',
                backgroundColor: 'rgba(108, 92, 231, 0.1)',
                tension: 0.4, fill: true
            }]
        });

        // 2. Branch Performance (Bar)
        const brs = [...new Set(this.data.map(d => d.branch))];
        const brData = brs.map(b => this.data.filter(d => d.branch === b).reduce((a, x) => a + x.nc, 0));
        this.createChart('chartBranch', 'bar', {
            labels: brs,
            datasets: [{ label: 'New Sales', data: brData, backgroundColor: colors }]
        });

        // 3. Share (Doughnut)
        this.createChart('chartShare', 'doughnut', {
            labels: brs,
            datasets: [{ data: brData, backgroundColor: colors, borderWidth: 0 }]
        });

        // 4. Rank (Horizontal)
        const sorted = [...this.data].sort((a, b) => b.nc - a.nc).slice(0, 10);
        this.createChart('chartRank', 'bar', {
            labels: sorted.map(d => d.manager),
            datasets: [{ label: 'Incentive Score', data: sorted.map(d => d.nc * 10), backgroundColor: '#00b894', borderRadius: 4 }],
        }, { indexAxis: 'y' });

        // 5. Radar (Aggregate Balance)
        const totals = ['nc', 'sub', 'cc', 'sus', 'ret'].map(k => this.data.reduce((a, b) => a + b[k], 0));
        this.createChart('chartRadar', 'radar', {
            labels: ['New', 'Sub', 'Cancel', 'Suspend', 'Retention'],
            datasets: [{ label: 'Metric Balance', data: totals, backgroundColor: 'rgba(253, 203, 110, 0.4)', borderColor: '#fdcb6e' }]
        });
    },

    createChart: function (id, type, data, opts = {}) {
        if (this.charts[id]) this.charts[id].destroy();
        this.charts[id] = new Chart(document.getElementById(id), {
            type: type, data: data,
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: type !== 'bar' } }, ...opts }
        });
    },

    renderList: function () {
        const tbody = document.getElementById('listBody');
        const filter = document.getElementById('filterBranch').value;
        const search = document.getElementById('searchInput').value.toLowerCase();

        let list = this.data.filter(d => {
            if (filter !== 'ALL' && d.branch !== filter) return false;
            return d.manager.toLowerCase().includes(search) || d.branch.toLowerCase().includes(search);
        });

        tbody.innerHTML = list.map(d => {
            // Colors based on value
            const susColor = d.sus > 0 ? '#e17055' : 'inherit';
            return `<tr>
                <td style="font-weight:bold">${d.branch}</td>
                <td>${d.manager}</td>
                <td style="color:var(--primary); font-weight:800">${d.nc}</td>
                <td>${d.sub}</td>
                <td style="color:#d63031">${d.cc}</td>
                <td style="color:${susColor}">${d.sus}</td>
                <td>${d.ret}</td>
                <td><button onclick="app.openModal(${d.id})" class="btn-outline" style="padding:4px 10px; font-size:12px;">Edit</button></td>
            </tr>`;
        }).join('');
    },

    renderTop10: function () {
        const list = [...this.data].sort((a, b) => b.nc - a.nc).slice(0, 10);
        document.getElementById('top10List').innerHTML = list.map((d, i) => `
            <div class="rank-item">
                <div class="rank-badge rank-${Math.min(i + 1, 3)}">${i + 1}</div>
                <div class="rank-info">
                    <div class="rank-name">${d.manager}</div>
                    <div class="rank-branch">${d.branch}</div>
                </div>
                <div class="rank-value">${d.nc}건</div>
            </div>
        `).join('');
    },

    // --- Interactions ---
    toggleTop10: function () {
        const p = document.getElementById('top10Panel');
        p.style.right = p.style.right === '0px' ? '-400px' : '0px';
    },
    showTab: function (id) {
        document.querySelectorAll('.page').forEach(e => e.style.display = 'none');
        document.getElementById(id).style.display = 'block';
    },

    openModal: function (id) {
        const d = this.data.find(x => x.id === id);
        if (!d) return;
        ['New', 'Sub', 'Cancel', 'Suspend', 'Retention'].forEach(k => document.getElementById('inp' + k).value = d[k === 'New' ? 'nc' : k === 'Cancel' ? 'cc' : k === 'Suspend' ? 'sus' : k === 'Subscription' ? 'sub' : 'ret']);
        document.getElementById('editId').value = id;
        document.getElementById('inpNote').value = d.note;
        document.getElementById('inputModal').style.display = 'flex';
    },
    closeModal: function () {
        document.getElementById('inputModal').style.display = 'none';
    },
    saveModalData: function () {
        const id = Number(document.getElementById('editId').value);
        const d = this.data.find(x => x.id === id);
        if (d) {
            d.nc = Number(document.getElementById('inpNew').value);
            d.sub = Number(document.getElementById('inpSub').value);
            d.cc = Number(document.getElementById('inpCancel').value);
            d.sus = Number(document.getElementById('inpSuspend').value);
            d.ret = Number(document.getElementById('inpRetention').value);
            d.note = document.getElementById('inpNote').value;
            this.save();
            this.closeModal();
            this.renderAll();
            this.showToast('Updated Successfully', 'success');
        }
    },

    // --- Utilities ---
    save: function () { localStorage.setItem('sa_data', JSON.stringify(this.data)); },
    showToast: function (msg, type = 'info') {
        const t = document.createElement('div');
        t.className = 'toast';
        t.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> ${msg}`;
        document.getElementById('toastContainer').appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }
};

window.onload = function () { app.init(); };

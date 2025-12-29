
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
        this.updateDate();
        this.renderAll();
    },

    updateDate: function () {
        const d = new Date();
        const str = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 기준`;
        const el = document.getElementById('currentDate');
        if (el) el.innerText = str;
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
        if (alertMsg && !confirm("모든 데이터를 초기화하고 예시 데이터를 생성하시겠습니까? (기존 데이터 삭제)")) return;
        this.processCSV(MASTER_CSV, true); // True = Replace
        if (alertMsg) this.showToast('데이터가 초기화되었습니다.', 'success');
    },

    handleFileUpload: function (input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            if (confirm("기존 데이터를 전부 [교체]하시겠습니까? \n취소(Cancel)를 누르면 [추가]됩니다.")) {
                this.processCSV(text, true);
                this.showToast('데이터가 교체되었습니다.', 'success');
            } else {
                this.processCSV(text, false);
                this.showToast('데이터가 추가되었습니다.', 'success');
            }
            input.value = '';
        };
        reader.readAsText(file);
    },

    processCSV: function (csvText, replace) {
        const lines = csvText.split('\n');
        const newData = [];
        let start = 0;
        if (lines[0] && (lines[0].includes('지사명') || lines[0].includes('Branch'))) start = 1;

        for (let i = start; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const p = line.split(',');
            if (p.length < 3) continue;

            const targetNew = Number(p[3]) || 10;
            newData.push({
                id: Date.now() + i + Math.floor(Math.random() * 1000),
                branch: p[0].trim(),
                code: p[1].trim(),
                manager: p[2].trim(),
                targetNew: targetNew,
                targetCancel: Number(p[4]) || 0,
                phone: p[5] ? p[5].trim() : '0000',

                nc: p[6] ? Number(p[6]) : (replace && csvText === MASTER_CSV ? Math.floor(Math.random() * (targetNew * 1.2)) : 0),
                sub: p[7] ? Number(p[7]) : (replace && csvText === MASTER_CSV ? Math.floor(Math.random() * 5) : 0),
                cc: p[8] ? Number(p[8]) : (replace && csvText === MASTER_CSV ? Math.floor(Math.random() * 3) : 0),
                sus: p[9] ? Number(p[9]) : (replace && csvText === MASTER_CSV ? Math.floor(Math.random() * 2) : 0),
                ret: p[10] ? Number(p[10]) : (replace && csvText === MASTER_CSV ? Math.floor(Math.random() * 5) : 0),
                note: p[11] || ''
            });
        }

        if (replace) this.data = newData;
        else this.data = [...this.data, ...newData];

        this.save();
        this.renderAll();
    },

    // --- Auth ---
    setLoginMode: function (m) {
        document.querySelectorAll('#loginForms > div').forEach(e => e.style.display = 'none');
        document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
        const formMap = { 'ADMIN': 'formAdmin', 'BRANCH': 'formBranch', 'STAFF': 'formStaff' };
        if (formMap[m]) document.getElementById(formMap[m]).style.display = 'block';

        if (m === 'BRANCH') this.fillBranchSelect('loginBranchSelect');
        if (m === 'STAFF') this.fillBranchSelect('loginStaffBranch');
    },
    fillBranchSelect: function (id) {
        const brs = [...new Set(this.data.map(d => d.branch))];
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<option value="">지사 선택</option>` + brs.map(b => `<option>${b}</option>`).join('');
    },
    login: function () {
        const adId = document.getElementById('adminId').value;
        const br = document.getElementById('loginBranchSelect').value;
        const stBr = document.getElementById('loginStaffBranch').value;

        let u = null;
        if (document.getElementById('formAdmin').style.display === 'block') {
            if (adId === 'admin') u = { role: 'ADMIN', name: '총괄 관리자', branch: '본사' };
        } else if (document.getElementById('formBranch').style.display === 'block') {
            if (br) u = { role: 'BRANCH', name: br + ' 지사장', branch: br };
        } else {
            if (stBr) u = { role: 'STAFF', name: '팀원', branch: stBr };
        }

        if (u) {
            this.user = u;
            sessionStorage.setItem('sa_user', JSON.stringify(u));
            this.showApp();
        } else {
            this.showToast('로그인 정보를 확인해주세요. (Admin: admin)', 'error');
        }
    },
    showApp: function () {
        document.getElementById('loginScreen').style.display = 'none';
        document.querySelector('.app-container').style.display = 'flex';
        document.getElementById('uName').innerText = this.user.name;
        document.getElementById('uRole').innerText = this.user.role === 'ADMIN' ? '최고 관리자' : (this.user.role === 'BRANCH' ? '지사 관리자' : '일반 팀원');
        document.querySelectorAll('.admin-only').forEach(e => e.style.display = this.user.role === 'ADMIN' ? 'flex' : 'none');
        this.renderAll();
        // Trigger generic animation
        document.querySelector('.dashboard-grid').style.opacity = '0';
        setTimeout(() => {
            document.querySelector('.dashboard-grid').style.transition = 'opacity 0.6s ease';
            document.querySelector('.dashboard-grid').style.opacity = '1';
        }, 100);
    },
    logout: function () {
        sessionStorage.removeItem('sa_user');
        location.reload();
    },

    // --- Render ---
    renderAll: function () {
        if (!this.user) return;
        this.renderStats();
        setTimeout(() => this.renderCharts(), 50);
        this.renderList();
        this.renderTop10();
    },

    renderStats: function () {
        if (!document.getElementById('dNew')) return;
        const sum = k => this.data.reduce((a, b) => a + (b[k] || 0), 0);
        document.getElementById('dNew').innerText = sum('nc').toLocaleString() + '건';
        document.getElementById('dSub').innerText = sum('sub').toLocaleString() + '건';
        document.getElementById('dSus').innerText = sum('sus').toLocaleString() + '건';
        document.getElementById('dCan').innerText = sum('cc').toLocaleString() + '건';
        document.getElementById('tNew').innerText = '목표: ' + sum('targetNew').toLocaleString();
        document.getElementById('tCan').innerText = '한도: ' + sum('targetCancel').toLocaleString();
    },

    // --- Premium Visualization ---
    getGradient: function (ctx, colorStart, colorEnd) {
        const gradient = ctx.createLinearGradient(0, 400, 0, 0);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);
        return gradient;
    },

    renderCharts: function () {
        Object.keys(this.charts).forEach(k => {
            if (this.charts[k]) { this.charts[k].destroy(); this.charts[k] = null; }
        });

        // Common Chart Defaults
        Chart.defaults.font.family = 'Pretendard, -apple-system, sans-serif';
        Chart.defaults.color = '#636e72';
        Chart.defaults.scale.grid.color = 'rgba(0,0,0,0.03)';

        // 1. Trend (Line)
        const ctxTrend = document.getElementById('chartTrend').getContext('2d');
        const gradTrend = this.getGradient(ctxTrend, 'rgba(108, 92, 231, 0.05)', 'rgba(108, 92, 231, 0.4)');

        const labels = ['1월', '2월', '3월', '4월', '5월', '6월'];
        this.createChart('chartTrend', 'line', {
            labels: labels,
            datasets: [{
                label: '월별 실적 추이',
                data: labels.map(() => Math.floor(Math.random() * 150) + 50),
                borderColor: '#6c5ce7',
                backgroundColor: gradTrend,
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#6c5ce7',
                pointRadius: 4,
                tension: 0.4, fill: true
            }]
        }, {
            scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
        });

        const brs = [...new Set(this.data.map(d => d.branch))];
        const brData = brs.map(b => this.data.filter(d => d.branch === b).reduce((a, x) => a + x.nc, 0));

        // 2. Branch (Bar - Gradient)
        const ctxBranch = document.getElementById('chartBranch').getContext('2d');
        const gradBar = this.getGradient(ctxBranch, '#a29bfe', '#6c5ce7');

        this.createChart('chartBranch', 'bar', {
            labels: brs,
            datasets: [{
                label: '신규 실적',
                data: brData,
                backgroundColor: gradBar,
                borderRadius: 8,
                barPercentage: 0.6
            }]
        });

        // 3. Share (Doughnut - Premium Colors)
        this.createChart('chartShare', 'doughnut', {
            labels: brs,
            datasets: [{
                data: brData,
                backgroundColor: ['#6c5ce7', '#00b894', '#0984e3', '#fdcb6e', '#e17055', '#d63031'],
                borderWidth: 0,
                hoverOffset: 15
            }]
        }, { cutout: '70%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true } } } });

        // 4. Rank (Horizontal Bar)
        const sorted = [...this.data].sort((a, b) => b.nc - a.nc).slice(0, 10);
        const ctxRank = document.getElementById('chartRank').getContext('2d');
        const gradRank = this.getGradient(ctxRank, '#55efc4', '#00b894');

        this.createChart('chartRank', 'bar', {
            labels: sorted.map(d => d.manager),
            datasets: [{
                label: '인센티브 스코어',
                data: sorted.map(d => d.nc * 10),
                backgroundColor: gradRank,
                borderRadius: 50,
                barThickness: 15
            }],
        }, { indexAxis: 'y', scales: { x: { display: false }, y: { grid: { display: false } } } });

        // 5. Radar
        const totals = ['nc', 'sub', 'cc', 'sus', 'ret'].map(k => this.data.reduce((a, b) => a + b[k], 0));
        this.createChart('chartRadar', 'radar', {
            labels: ['신규', '청약', '해지', '정지', '리텐션'],
            datasets: [{
                label: '지표 밸런스',
                data: totals,
                backgroundColor: 'rgba(253, 203, 110, 0.2)',
                borderColor: '#fdcb6e',
                borderWidth: 2,
                pointBackgroundColor: '#fdcb6e'
            }]
        }, { scales: { r: { ticks: { display: false }, grid: { circular: true } } } });
    },

    createChart: function (id, type, data, opts = {}) {
        const el = document.getElementById(id);
        if (!el) return;
        this.charts[id] = new Chart(el, {
            type: type, data: data,
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: type !== 'bar' } }, ...opts }
        });
    },

    renderList: function () {
        const tbody = document.getElementById('listBody');
        if (!tbody) return;
        const filter = document.getElementById('filterBranch').value;
        const search = document.getElementById('searchInput').value.toLowerCase();

        let list = this.data.filter(d => {
            if (filter !== 'ALL' && d.branch !== filter) return false;
            return d.manager.toLowerCase().includes(search) || d.branch.toLowerCase().includes(search);
        });

        if (!list.length) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#b2bec3;">데이터가 없습니다.</td></tr>`; return; }

        tbody.innerHTML = list.map(d => {
            const susColor = d.sus > 0 ? '#e17055' : 'inherit';
            return `<tr>
                <td style="font-weight:600">${d.branch}</td>
                <td>${d.manager}</td>
                <td style="color:var(--primary); font-weight:800">${d.nc}</td>
                <td>${d.sub}</td>
                <td style="color:#d63031">${d.cc}</td>
                <td style="color:${susColor}">${d.sus}</td>
                <td>${d.ret}</td>
                <td><button onclick="app.openModal(${d.id})" class="btn-outline" style="padding:6px 14px; font-size:12px;">수정</button></td>
            </tr>`;
        }).join('');
    },

    renderTop10: function () {
        const el = document.getElementById('top10List');
        if (!el) return;
        const list = [...this.data].sort((a, b) => b.nc - a.nc).slice(0, 10);
        el.innerHTML = list.map((d, i) => `
            <div class="rank-item">
                <div class="rank-badge rank-${Math.min(i + 1, 3)}">${i + 1}</div>
                <div class="rank-info">
                    <div class="rank-name">${d.manager}</div>
                    <div class="rank-branch">${d.branch}</div>
                </div>
                <div class="rank-value">${d.nc}<small>건</small></div>
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
        document.querySelector('.nav-item.active').classList.remove('active');
        // Simple active state toggle by text finding (simplified)
        // In real app, bind ID to nav items
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
    closeModal: function () { document.getElementById('inputModal').style.display = 'none'; },
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
            this.showToast('성공적으로 저장되었습니다.', 'success');
        }
    },

    downloadCSV: function () {
        let csv = "지사명,구역코드,담당자명,신규목표,해지목표,전화번호,신규,청약,해지,정지,리텐션,비고\n";
        this.data.forEach(d => {
            csv += `${d.branch},${d.code},${d.manager},${d.targetNew},${d.targetCancel},${d.phone},${d.nc},${d.sub},${d.cc},${d.sus},${d.ret},${d.note}\n`
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }));
        link.download = "sales_report_ko.csv";
        link.click();
    },

    save: function () { localStorage.setItem('sa_data', JSON.stringify(this.data)); },
    showToast: function (msg, type = 'info') {
        const t = document.createElement('div');
        t.className = 'toast';
        t.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> ${msg}`;
        const c = document.getElementById('toastContainer');
        if (c) c.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    },
    backupData: function () {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([JSON.stringify(this.data)], { type: 'application/json' }));
        link.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
    },
    updateFee: function () {
        const v = document.getElementById('inpFee').value;
        this.config.fee = Number(v);
        localStorage.setItem('sa_config', JSON.stringify(this.config));
        this.showToast('수수료 설정이 저장되었습니다.');
    }
};

window.onload = function () { app.init(); };

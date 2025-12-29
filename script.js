
const BRANCH_LIST = ['중앙', '강북', '서대문', '고양', '의정부', '남양주', '강릉', '원주'];
const MASTER_CSV = `지사명,구역코드,담당자명,신규목표,해지목표,휴대폰뒷자리
중앙지사,G001,김중앙,50,2,0000
강북지사,G002,박강북,60,5,0000
서대문지사,G003,이서대,45,2,0000
고양지사,G004,정고양,40,3,0000
의정부지사,G005,최의정,35,1,0000
남양주지사,G006,조남양,30,2,0000
강릉지사,G007,유강릉,25,0,0000
원주지사,G008,한원주,20,1,0000`;

Chart.register(ChartDataLabels);

const app = {
    user: null,
    config: JSON.parse(localStorage.getItem('sa_config')) || { fee: 30, theme: 'light' },
    data: JSON.parse(localStorage.getItem('sa_data')) || [],
    charts: {},
    viewMode: 'COUNT', // 'COUNT' or 'AMOUNT'

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

    // --- Interaction ---
    toggleView: function (mode) {
        this.viewMode = mode;
        const btnC = document.getElementById('btnViewCount');
        const btnA = document.getElementById('btnViewAmount');
        if (mode === 'COUNT') {
            btnC.className = 'btn-gradient'; btnC.style.color = 'white';
            btnA.className = 'btn-outline'; btnA.style.border = 'none'; btnA.style.color = 'var(--text-sub)';
        } else {
            btnA.className = 'btn-gradient'; btnA.style.color = 'white';
            btnC.className = 'btn-outline'; btnC.style.border = 'none'; btnC.style.color = 'var(--text-sub)';
        }
        this.renderAll();
        this.showToast(`보기 모드 변경: ${mode === 'COUNT' ? '건수' : '금액'}`, 'success');
    },

    openDetail: function (type) {
        const map = { 'NEW': { k: 'nc', t: '신규 유치 상세' }, 'SUB': { k: 'sub', t: '청약 현황 상세' }, 'SUS': { k: 'sus', t: '정지 관리 상세' }, 'CANCEL': { k: 'cc', t: '해지 방어 상세' } };
        const cfg = map[type];
        if (!cfg) return;

        document.getElementById('detailTitle').innerText = cfg.t;

        // Aggregate by Branch (Fixed List)
        let branchHtml = `<h4 style="margin:0 0 10px 0;">🏢 지사별 현황</h4><div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">`;
        BRANCH_LIST.forEach(br => {
            const count = this.data.filter(d => d.branch.startsWith(br)).reduce((a, x) => a + this.getValue(x, cfg.k), 0);
            branchHtml += `<div style="background:rgba(0,0,0,0.03); padding:10px; border-radius:8px; display:flex; justify-content:space-between;">
                <span>${br}</span><span style="font-weight:bold;">${this.getFormat(count)}</span>
            </div>`;
        });
        branchHtml += `</div>`;

        // Top Managers
        const sorted = [...this.data].map(d => ({ ...d, val: this.getValue(d, cfg.k) })).filter(d => d.val > 0).sort((a, b) => b.val - a.val).slice(0, 10);
        let mgrHtml = `<h4 style="margin:20px 0 10px 0;">🏆 담당자 Top 10</h4><table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead style="background:rgba(0,0,0,0.02);"><tr style="text-align:left;"><th style="padding:8px;">순위</th><th>담당자</th><th>지사</th><th style="text-align:right;">실적</th></tr></thead><tbody>`;

        mgrHtml += sorted.map((d, i) => `
            <tr style="border-bottom:1px solid rgba(0,0,0,0.05);">
                <td style="padding:8px;">${i + 1}</td>
                <td>${d.manager}</td>
                <td style="color:#636e72;">${d.branch}</td>
                <td style="text-align:right; font-weight:bold;">${this.getFormat(d.val)}</td>
            </tr>
        `).join('') || `<tr><td colspan="4" style="padding:10px; text-align:center;">데이터 없음</td></tr>`;
        mgrHtml += `</tbody></table>`;

        document.getElementById('detailContent').innerHTML = branchHtml + mgrHtml;
        document.getElementById('detailModal').style.display = 'flex';
    },

    // --- Data Logic ---
    initData: function (alertMsg = true) {
        if (alertMsg && !confirm("모든 데이터를 초기화하고 8개 지사 예시를 생성하시겠습니까?")) return;
        this.processCSV(MASTER_CSV, true);
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
            const isDemo = replace && csvText === MASTER_CSV;

            newData.push({
                id: Date.now() + i + Math.floor(Math.random() * 10000),
                branch: p[0].trim(),
                code: p[1].trim(),
                manager: p[2].trim(),
                targetNew: targetNew,
                targetCancel: Number(p[4]) || 0,
                phone: p[5] ? p[5].trim() : '0000',

                nc: p[6] ? Number(p[6]) : (isDemo ? Math.floor(Math.random() * (targetNew * 1.2)) : 0),
                sub: p[7] ? Number(p[7]) : (isDemo ? Math.floor(Math.random() * 5) : 0),
                cc: p[8] ? Number(p[8]) : (isDemo ? Math.floor(Math.random() * 3) : 0),
                sus: p[9] ? Number(p[9]) : (isDemo ? Math.floor(Math.random() * 2) : 0),
                ret: p[10] ? Number(p[10]) : (isDemo ? Math.floor(Math.random() * 5) : 0),

                retType: p[11] || (isDemo ? ['인하', '할인', '면제'][Math.floor(Math.random() * 3)] : ''),
                retPrice: p[12] ? Number(p[12]) : (isDemo ? Math.floor(Math.random() * 100) : 0),
                note: p[13] || ''
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
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<option value="">지사 선택</option>` + BRANCH_LIST.map(b => `<option>${b}</option>`).join('');
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
            this.showToast('로그인 정보를 확인해주세요.', 'error');
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
    logout: function () { sessionStorage.removeItem('sa_user'); location.reload(); },

    // --- Render Logic ---
    getValue: function (d, key) {
        if (this.viewMode === 'COUNT') return d[key] || 0;
        if (key === 'nc' || key === 'sub' || key === 'cc' || key === 'sus') return (d[key] || 0) * this.config.fee;
        if (key === 'ret') return d.retPrice || 0;
        return 0;
    },
    getFormat: function (val) {
        if (this.viewMode === 'COUNT') return val.toLocaleString() + '건';
        return val.toLocaleString() + '천';
    },

    renderAll: function () {
        if (!this.user) return;
        this.renderStats();
        setTimeout(() => {
            this.renderCharts();
            this.renderBranchChart(); // Separate render for specific reload
        }, 50);
        this.renderList();
        this.renderTop10();
    },

    renderStats: function () {
        if (!document.getElementById('dNew')) return;
        const sum = (key) => this.data.reduce((a, b) => a + this.getValue(b, key), 0);
        const sumTGT = (key) => this.data.reduce((a, b) => a + (this.viewMode === 'COUNT' ? (b[key] || 0) : (b[key] || 0) * this.config.fee), 0);
        document.getElementById('dNew').innerText = this.getFormat(sum('nc'));
        document.getElementById('dSub').innerText = this.getFormat(sum('sub'));
        document.getElementById('dSus').innerText = this.getFormat(sum('sus'));
        document.getElementById('dCan').innerText = this.getFormat(sum('cc'));
        document.getElementById('tNew').innerText = '목표: ' + this.getFormat(sumTGT('targetNew'));
        document.getElementById('tCan').innerText = '한도: ' + this.getFormat(sumTGT('targetCancel'));
    },

    renderBranchChart: function () {
        const id = 'chartBranch';
        if (this.charts[id]) { this.charts[id].destroy(); }

        Chart.defaults.font.family = 'Pretendard';

        // Multi-Metric Logic
        const showNew = document.getElementById('chkNew').checked;
        const showSub = document.getElementById('chkSub').checked;
        const showCan = document.getElementById('chkCan').checked;
        const showSus = document.getElementById('chkSus').checked;

        const datasets = [];

        if (showNew) {
            const d = BRANCH_LIST.map(b => this.data.filter(x => x.branch.startsWith(b)).reduce((a, x) => a + this.getValue(x, 'nc'), 0));
            datasets.push({ label: '신규', data: d, backgroundColor: '#6c5ce7', borderRadius: 4 });
        }
        if (showSub) {
            const d = BRANCH_LIST.map(b => this.data.filter(x => x.branch.startsWith(b)).reduce((a, x) => a + this.getValue(x, 'sub'), 0));
            datasets.push({ label: '청약', data: d, backgroundColor: '#00b894', borderRadius: 4 });
        }
        if (showCan) {
            const d = BRANCH_LIST.map(b => this.data.filter(x => x.branch.startsWith(b)).reduce((a, x) => a + this.getValue(x, 'cc'), 0));
            datasets.push({ label: '해지', data: d, backgroundColor: '#d63031', borderRadius: 4 });
        }
        if (showSus) {
            const d = BRANCH_LIST.map(b => this.data.filter(x => x.branch.startsWith(b)).reduce((a, x) => a + this.getValue(x, 'sus'), 0));
            datasets.push({ label: '정지', data: d, backgroundColor: '#e17055', borderRadius: 4 });
        }

        this.createChart(id, 'bar', {
            labels: BRANCH_LIST,
            datasets: datasets
        }, {
            plugins: {
                legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 10, usePointStyle: true } },
                datalabels: { display: true, color: '#444', font: { weight: 'bold', size: 10 }, anchor: 'end', align: 'top', offset: -2, formatter: (v) => v > 0 ? v.toLocaleString() : '' }
            },
            responsive: true, maintainAspectRatio: false,
            scales: { x: { grid: { display: false } } }
        });
    },

    renderCharts: function () {
        // Render others normally
        ['chartTrend', 'chartShare', 'chartRank', 'chartRadar'].forEach(k => { if (this.charts[k]) this.charts[k].destroy(); });

        Chart.defaults.font.family = 'Pretendard';
        Chart.defaults.color = '#636e72';

        const commonOptions = {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: true, color: '#444', font: { weight: 'bold', size: 10 },
                    anchor: 'end', align: 'top', offset: -2,
                    formatter: (v) => v > 0 ? v.toLocaleString() : ''
                }
            }
        };

        const brData = BRANCH_LIST.map(b => this.data.filter(d => d.branch.startsWith(b)).reduce((a, x) => a + this.getValue(x, 'nc'), 0));

        // 1. Trend (12 Months + Cumulative)
        const labels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        const scale = this.viewMode === 'AMOUNT' ? this.config.fee : 1;
        const monthlyData = labels.map(() => Math.floor(Math.random() * 50 * scale));
        const accData = monthlyData.reduce((acc, curr, i) => [...acc, (acc[i - 1] || 0) + curr], []);

        this.createChart('chartTrend', 'line', {
            labels: labels,
            datasets: [
                {
                    label: '월별 실적',
                    data: monthlyData,
                    borderColor: '#6c5ce7', backgroundColor: 'transparent',
                    borderWidth: 2, tension: 0.4,
                    datalabels: { align: 'top', offset: 4 }
                },
                {
                    label: '누적 실적(연간)',
                    data: accData,
                    borderColor: '#a29bfe',
                    backgroundColor: 'rgba(108, 92, 231, 0.05)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: 'start',
                    tension: 0.4,
                    datalabels: { display: false }
                }
            ]
        }, { ...commonOptions, plugins: { legend: { display: true }, datalabels: { display: true } }, scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } });


        // 3. Share (Fixed 8 - Centered & Padded)
        this.createChart('chartShare', 'doughnut', {
            labels: BRANCH_LIST,
            datasets: [{
                data: brData,
                backgroundColor: ['#6c5ce7', '#00b894', '#0984e3', '#fdcb6e', '#e17055', '#d63031', '#636e72', '#2d3436'],
                borderWidth: 0
            }]
        }, {
            layout: { padding: 20 },
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, padding: 15, font: { size: 11 } } },
                datalabels: {
                    color: 'white', formatter: (v, ctx) => {
                        let sum = 0;
                        ctx.chart.data.datasets[0].data.map(data => { sum += data; });
                        if (sum === 0) return '0%';
                        let percentage = (v * 100 / sum).toFixed(1) + "%";
                        return v > 0 ? percentage : '';
                    }
                }
            }, maintainAspectRatio: false
        });

        // 4. Rank
        const sorted = [...this.data].map(d => ({ ...d, val: this.getValue(d, 'nc') })).sort((a, b) => b.val - a.val).slice(0, 10);
        this.createChart('chartRank', 'bar', {
            labels: sorted.map(d => d.manager),
            datasets: [{
                data: sorted.map(d => d.val),
                backgroundColor: '#00b894', borderRadius: 20, barThickness: 12
            }]
        }, { indexAxis: 'y', ...commonOptions, scales: { x: { display: false }, y: { grid: { display: false } } } });

        // 5. Radar
        const totalAgg = (k) => this.data.reduce((a, b) => a + this.getValue(b, k), 0);
        const radarData = ['nc', 'sub', 'cc', 'sus', 'ret'].map(k => totalAgg(k));
        this.createChart('chartRadar', 'radar', {
            labels: ['신규', '청약', '해지', '정지', '리텐션'],
            datasets: [{
                data: radarData,
                backgroundColor: 'rgba(253, 203, 110, 0.2)', borderColor: '#fdcb6e', borderWidth: 2
            }]
        }, { plugins: { legend: { display: false }, datalabels: { display: true, backgroundColor: 'white', borderRadius: 4 } }, scales: { r: { ticks: { display: false } } } });
    },

    createChart: function (id, type, data, opts) {
        const el = document.getElementById(id);
        if (!el) return;
        this.charts[id] = new Chart(el, { type, data, options: opts });
    },

    renderList: function () {
        const tbody = document.getElementById('listBody');
        if (!tbody) return;
        const filter = document.getElementById('filterBranch').value;
        const search = document.getElementById('searchInput').value.toLowerCase();

        let list = this.data.filter(d => {
            if (filter !== 'ALL' && !d.branch.startsWith(filter)) return false;
            return d.manager.toLowerCase().includes(search) || d.branch.toLowerCase().includes(search);
        });

        if (!list.length) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px;">데이터 없음</td></tr>`; return; }

        tbody.innerHTML = list.map(d => {
            return `<tr>
                <td style="font-weight:600">${d.branch}</td>
                <td>${d.manager}</td>
                <td style="color:var(--primary); font-weight:800">${d.nc}</td>
                <td>${d.sub}</td>
                <td style="color:#d63031">${d.cc}</td>
                <td style="color:${d.sus > 0 ? '#e17055' : 'inherit'}">${d.sus}</td>
                <td>
                    <div style="font-size:12px; font-weight:bold;">${d.ret}</div>
                    ${d.retType ? `<span style="font-size:10px; padding:2px 4px; background:#dfe6e9; border-radius:4px;">${d.retType}</span>` : ''}
                </td>
                <td><button onclick="app.openModal(${d.id})" class="btn-outline" style="padding:4px 8px; font-size:12px;">수정</button></td>
            </tr>`;
        }).join('');
    },

    // --- Modal Logic ---
    openModal: function (id) {
        const d = this.data.find(x => x.id === id);
        if (!d) return;
        ['New', 'Sub', 'Cancel', 'Suspend', 'Retention'].forEach(k => document.getElementById('inp' + k).value = d[k === 'New' ? 'nc' : k === 'Cancel' ? 'cc' : k === 'Suspend' ? 'sus' : k === 'Subscription' ? 'sub' : 'ret']);
        document.getElementById('inpRetType').value = d.retType || '';
        document.getElementById('inpRetPrice').value = d.retPrice || 0;
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
            d.retType = document.getElementById('inpRetType').value;
            d.retPrice = Number(document.getElementById('inpRetPrice').value);
            d.note = document.getElementById('inpNote').value;
            this.save();
            this.closeModal();
            this.renderAll();
            this.showToast('저장되었습니다.', 'success');
        }
    },

    // ... Utils ...
    toggleTop10: function () { const p = document.getElementById('top10Panel'); p.style.right = p.style.right === '0px' ? '-400px' : '0px'; },
    renderTop10: function () {
        const el = document.getElementById('top10List');
        const sorted = [...this.data].map(d => ({ ...d, val: this.getValue(d, 'nc') })).sort((a, b) => b.val - a.val).slice(0, 10);
        el.innerHTML = sorted.map((d, i) => `
            <div class="rank-item">
                <div class="rank-badge rank-${Math.min(i + 1, 3)}">${i + 1}</div>
                <div class="rank-info"><div class="rank-name">${d.manager}</div><div class="rank-branch">${d.branch}</div></div>
                <div class="rank-value">${this.getFormat(d.val)}</div>
            </div>`).join('');
    },
    save: function () { localStorage.setItem('sa_data', JSON.stringify(this.data)); },
    showToast: function (msg, t = 'info') {
        const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `<span>${t === 'success' ? '✅' : 'ℹ️'}</span> ${msg}`;
        document.getElementById('toastContainer').appendChild(el); setTimeout(() => el.remove(), 3000);
    },
    updateFee: function () {
        const v = document.getElementById('inpFee').value;
        this.config.fee = Number(v);
        localStorage.setItem('sa_config', JSON.stringify(this.config));
        this.renderAll();
        this.showToast('수수료 설정이 저장되었습니다.');
    },
    backupData: function () {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([JSON.stringify(this.data)], { type: 'application/json' }));
        link.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
    },
    downloadCSV: function () {
        let csv = "Branch,Manager,New,Sub,Cancel,Suspend,Ret,RetType,RetPrice,Note\n";
        this.data.forEach(d => csv += `${d.branch},${d.manager},${d.nc},${d.sub},${d.cc},${d.sus},${d.ret},${d.retType},${d.retPrice},${d.note}\n`);
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' }));
        a.download = "sales.csv"; a.click();
    }
};

window.onload = function () { app.init(); };

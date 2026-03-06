import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Car, Navigation, AlertCircle, Map, Smartphone, Eye, EyeOff, Signal,
  Plane, Users, Briefcase, MapPin, Flag, ClipboardList, CheckCircle,
  Clock, Settings, User, Trash2, Tag, Building2, Home, Edit3, ShieldAlert,
  FileText, Upload, Ban, Send, Phone, MessageSquare, LogOut, UserCog,
  LayoutDashboard, MoreHorizontal, DollarSign, Printer, Download, Search,
  FileSpreadsheet, Plus, Lock, History, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ROLES = {
  ADMIN: 'ADMIN',
  DISPATCHER: 'DISPATCHER',
  ACCOUNTANT: 'ACCOUNTANT'
};

const MENU_ITEMS = [
  { id: 'dashboard', label: '營運總覽', icon: LayoutDashboard, roles: [ROLES.ADMIN, ROLES.DISPATCHER, ROLES.ACCOUNTANT] },
  { id: 'tracking', label: '即時監控', icon: Map, roles: [ROLES.ADMIN, ROLES.DISPATCHER] },
  { id: 'booking', label: '新增預約', icon: Plus, roles: [ROLES.ADMIN, ROLES.DISPATCHER] },
  { id: 'dispatch', label: '派單管理', icon: Send, roles: [ROLES.ADMIN, ROLES.DISPATCHER] },
  { id: 'order_query', label: '訂單管理', icon: ClipboardList, roles: [ROLES.ADMIN, ROLES.DISPATCHER, ROLES.ACCOUNTANT] },
  { id: 'fleet', label: '車隊管理', icon: Car, roles: [ROLES.ADMIN, ROLES.DISPATCHER] },
  { id: 'drivers', label: '司機管理', icon: Users, roles: [ROLES.ADMIN, ROLES.DISPATCHER] },
  { id: 'customers', label: '客戶管理', icon: User, roles: [ROLES.ADMIN, ROLES.DISPATCHER, ROLES.ACCOUNTANT] },
  { id: 'settings', label: '費率設定', icon: Settings, roles: [ROLES.ADMIN] }
];

const todayStr = new Date().toISOString().split('T')[0];
const currentTimeStr = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

const App = () => {
  const [appRole, setAppRole] = useState<'erp' | 'customer' | 'driver'>('erp');
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [printingOrders, setPrintingOrders] = useState<any[]>([]);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [showLineModal, setShowLineModal] = useState(false);
  const [currentOrderForDispatch, setCurrentOrderForDispatch] = useState<any>(null);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // --- Mock Data ---
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [rates, setRates] = useState<any>({
    baseFare: 1000,
    nightSurcharge: 200,
    stopFee: 300,
    signFee: 100,
    babySeatFee: 200
  });
  const [stats, setStats] = useState<any>({ today_trips: 0, pending_trips: 0, available_drivers: 0 });

  useEffect(() => {
    if (appRole === 'erp') {
      fetchData();
    }
  }, [appRole]);

  const fetchData = async () => {
    try {
      const [oRes, dRes, cRes, rRes, sRes, vRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/drivers'),
        fetch('/api/customers'),
        fetch('/api/rates'),
        fetch('/api/stats'),
        fetch('/api/vehicles')
      ]);
      setOrders(await oRes.json());
      setDrivers(await dRes.json());
      setCustomers(await cRes.json());
      setRouteRates(await rRes.json());
      setStats(await sRes.json());
      setFleet(await vRes.json());
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  const [carTypes, setCarTypes] = useState([
    '四人座轎車', '七人座商務', '保母車', '九人座大車', '中巴', '三排大巴', '四排大巴', '豪華進口車'
  ]);

  const [routeRates, setRouteRates] = useState<any[]>([]);

  const [fleet, setFleet] = useState<any[]>([]);

  // --- Logic ---
  const handleLogin = (userInfo: any) => {
    setUser(userInfo);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    if (window.confirm('確定要登出系統嗎？')) {
      setUser(null);
    }
  };

  const checkMonitoringStatus = (driverId: string) => {
    const activeOrder = orders.find(o => o.driverId === driverId && o.status === 'assigned');
    if (!activeOrder) return { isMonitored: false, reason: '無執行中訂單' };
    return { isMonitored: true, reason: '監控中: 機場接送' };
  };

  const getDriverEligibility = (driver: any) => {
    if (driver.isBlacklisted) return { eligible: false, reason: '黑名單' };
    if (driver.status === 'busy') return { eligible: true, reason: '執勤中', warning: true };
    return { eligible: true, reason: '可派遣' };
  };

  const handleDispatch = async (orderId: string, driverId: string) => {
    try {
      const res = await fetch(`/api/bookings/${orderId}/dispatch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, vehicle_id: 1 }) // Simplified vehicle_id
      });
      if (res.ok) {
        fetchData();
        setShowLineModal(false);
      }
    } catch (error) {
      console.error("Dispatch failed", error);
    }
  };

  const handleSaveOrder = async (updatedOrder: any) => {
    try {
      const res = await fetch(`/api/bookings/${updatedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder)
      });
      if (res.ok) {
        fetchData();
        setEditingOrder(null);
      }
    } catch (error) {
      console.error("Failed to save order", error);
    }
  };

  const handleDeleteOrder = async (id: number) => {
    if (!window.confirm('確定要刪除此訂單嗎？此操作無法復原。')) return;
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete order", error);
    }
  };

  const handleSaveCustomer = async (customer: any) => {
    try {
      const isNew = !customer.id;
      const url = isNew ? '/api/customers' : `/api/customers/${customer.id}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
      });
      
      if (res.ok) {
        fetchData();
        setShowCustomerModal(false);
        setEditingCustomer(null);
      }
    } catch (error) {
      console.error("Failed to save customer", error);
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!window.confirm('確定要刪除此客戶嗎？此操作無法復原。')) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete customer", error);
    }
  };

  // --- Views ---
  if (appRole === 'customer') return <CustomerPortal onBookingCreated={() => {}} setAppRole={setAppRole} rates={rates} routeRates={routeRates} carTypes={carTypes} />;
  if (appRole === 'driver') return <DriverApp drivers={drivers} orders={orders} setOrders={setOrders} setAppRole={setAppRole} />;

  if (!user) {
    return <LoginView onLogin={handleLogin} setAppRole={setAppRole} />;
  }

  const availableMenuItems = MENU_ITEMS.filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 hidden md:flex flex-col shadow-2xl z-20 no-print">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-yellow-500 p-2 rounded-lg text-slate-900 shadow-[0_0_15px_rgba(234,179,8,0.5)]">
              <Car size={24} />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block leading-none">SkyLink</span>
              <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Dispatch Pro</span>
            </div>
          </div>

          <div className="mb-6 px-4 py-3 bg-slate-800 rounded-xl flex items-center gap-3 border border-slate-700">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-bold text-slate-900">
              {user.name[0]}
            </div>
            <div className="overflow-hidden">
              <div className="font-bold text-sm truncate">{user.name}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <UserCog size={10} />
                {user.role === ROLES.ADMIN ? '系統管理員' : '調度員'}
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {availableMenuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                <item.icon size={18} />
                <span className="font-bold text-sm">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800 space-y-2">
          <button onClick={() => setAppRole('customer')} className="w-full text-xs text-blue-400 hover:underline text-center block">切換至客戶預約端</button>
          <button onClick={() => setAppRole('driver')} className="w-full text-xs text-blue-400 hover:underline text-center block">切換至司機端 APP</button>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 py-3 rounded-xl transition-all font-bold text-sm mt-4">
            <LogOut size={16} /> 登出系統
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen bg-slate-50 relative">
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10 flex justify-between items-center shadow-sm backdrop-blur-md bg-white/90">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {MENU_ITEMS.find(i => i.id === activeTab)?.label}
          </h1>
          <div className="text-sm text-slate-500 font-mono bg-slate-100 px-3 py-1 rounded-full flex items-center gap-2">
            <Clock size={14} /> {todayStr} {currentTimeStr}
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <DashboardView stats={{ today_trips: orders.length, pending_trips: orders.filter(o => o.status === 'pending').length, available_drivers: drivers.filter(d => d.status === 'available').length }} orders={orders} drivers={drivers} setActiveTab={setActiveTab} />}
            {activeTab === 'tracking' && <LiveTrackingView drivers={drivers} checkMonitoringStatus={checkMonitoringStatus} />}
            {activeTab === 'booking' && <BookingView rates={rates} routeRates={routeRates} customers={customers} carTypes={carTypes} user={user} setOrders={setOrders} orders={orders} setActiveTab={setActiveTab} />}
            {activeTab === 'dispatch' && <DispatchView orders={orders} drivers={drivers} setPrintingOrders={setPrintingOrders} setCurrentOrderForDispatch={setCurrentOrderForDispatch} setShowLineModal={setShowLineModal} />}
            {activeTab === 'order_query' && <OrderManagementView orders={orders} drivers={drivers} setEditingOrder={setEditingOrder} setPrintingOrders={setPrintingOrders} onDeleteOrder={handleDeleteOrder} />}
            {activeTab === 'fleet' && <FleetView fleet={fleet} carTypes={carTypes} setCarTypes={setCarTypes} />}
            {activeTab === 'drivers' && <DriversView drivers={drivers} driverSearchQuery={driverSearchQuery} setDriverSearchQuery={setDriverSearchQuery} setEditingDriver={setEditingDriver} setShowDriverModal={setShowDriverModal} />}
            {activeTab === 'customers' && <CustomersView customers={customers} customerSearchQuery={customerSearchQuery} setCustomerSearchQuery={setCustomerSearchQuery} setEditingCustomer={setEditingCustomer} setShowCustomerModal={setShowCustomerModal} onDeleteCustomer={handleDeleteCustomer} />}
            {activeTab === 'settings' && <SettingsView rates={rates} setRates={setRates} routeRates={routeRates} setRouteRates={setRouteRates} carTypes={carTypes} />}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      {showLineModal && currentOrderForDispatch && (
        <DispatchModal 
          order={currentOrderForDispatch} 
          drivers={drivers} 
          getDriverEligibility={getDriverEligibility} 
          handleDispatch={handleDispatch} 
          onClose={() => setShowLineModal(false)} 
        />
      )}
      {editingOrder && <OrderEditModal order={editingOrder} setOrder={setEditingOrder} onSave={handleSaveOrder} carTypes={carTypes} onClose={() => setEditingOrder(null)} />}
      {showCustomerModal && (
        <CustomerModal 
          customer={editingCustomer} 
          onSave={handleSaveCustomer} 
          onClose={() => { setShowCustomerModal(false); setEditingCustomer(null); }} 
        />
      )}
    </div>
  );
};

// --- Sub-Views ---

const DashboardView = ({ stats, orders, drivers, setActiveTab }: any) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard title="今日總訂單" value={stats.today_trips} icon={<Car />} color="bg-blue-600" />
      <StatCard title="待調度案件" value={stats.pending_trips} icon={<AlertCircle />} color="bg-amber-500" />
      <StatCard title="可用司機" value={stats.available_drivers} icon={<Users />} color="bg-emerald-600" />
      <StatCard title="執勤中車輛" value={drivers.filter((d: any) => d.status === 'busy').length} icon={<Navigation />} color="bg-indigo-600" />
    </div>
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg">近期訂單</h3>
        <button onClick={() => setActiveTab('order_query')} className="text-sm text-blue-600 font-bold hover:underline">查看全部</button>
      </div>
      <OrderTable data={orders.slice(0, 5)} drivers={drivers} />
    </div>
  </motion.div>
);

const LiveTrackingView = ({ drivers, checkMonitoringStatus }: any) => (
  <div className="flex h-[calc(100vh-180px)] gap-6">
    <div className="w-80 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Smartphone size={18} /> 司機即時定位</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {drivers.map((d: any) => {
          const { isMonitored } = checkMonitoringStatus(d.id);
          return (
            <div key={d.id} className={`p-3 border rounded-lg ${isMonitored ? 'border-green-200 bg-green-50' : 'bg-white'}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold">{d.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isMonitored ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {isMonitored ? '監控中' : '未上線'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{d.car}</p>
            </div>
          );
        })}
      </div>
    </div>
    <div className="flex-1 bg-slate-200 rounded-xl relative overflow-hidden shadow-inner flex items-center justify-center text-slate-400">
      <div className="text-center">
        <Map size={48} className="mx-auto mb-4 opacity-20" />
        <p className="font-bold">即時監控地圖 (Demo 模擬中)</p>
        <p className="text-xs">整合 Google Maps API 後可顯示真實路況與軌跡</p>
      </div>
    </div>
  </div>
);

const BookingView = ({ rates, routeRates, customers, carTypes, user, setOrders, orders, setActiveTab }: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    source: '電話預約',
    type: '機場送機',
    carType: '四人座轎車',
    customer: '',
    phone: '',
    date: todayStr,
    time: '12:00',
    pax: 1,
    luggage: 1,
    pickup: '',
    dropoff: '',
    stops: [] as string[],
    options: { sign: false, babySeat: false },
    notes: '',
    flightNumber: '',
    flightTime: '',
    paymentStatus: '未付款'
  });

  const [selectedCompany, setSelectedCompany] = useState('');

  const uniqueCompanies = useMemo(() => {
    const companies = customers.map((c: any) => c.company || '其他/個人');
    return [...new Set(companies)] as string[];
  }, [customers]);

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCompany(e.target.value);
    setForm(prev => ({ ...prev, customer: '', phone: '' }));
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    const customer = customers.find((c: any) => String(c.id) === customerId);
    if (customer) {
      setForm(prev => ({
        ...prev,
        customer: customer.name,
        phone: customer.phone
      }));
    }
  };

  const addStop = () => setForm(prev => ({ ...prev, stops: [...prev.stops, ''] }));
  const updateStop = (idx: number, val: string) => {
    const newStops = [...form.stops];
    newStops[idx] = val;
    setForm(prev => ({ ...prev, stops: newStops }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (window.confirm(`確認匯入檔案：${file.name}？`)) {
      const importedOrders = [
        {
          id: `ORD-${Date.now()}-IMP1`,
          source: 'Excel匯入',
          type: '機場接機',
          customer: '林測試 (匯入)',
          phone: '0900111222',
          date: todayStr,
          time: '15:30',
          pickup: '桃園機場第二航廈',
          dropoff: '台北市大安區',
          carType: '四人座轎車',
          pax: 2,
          luggage: 2,
          stops: [],
          options: { sign: true, babySeat: false },
          notes: '匯入測試單',
          flightNumber: 'JX-800',
          flightTime: '14:30',
          price: 1300,
          paymentStatus: '未付款',
          status: 'pending',
          driverId: null,
          logs: [{ action: '匯入訂單', time: new Date().toLocaleString(), user: user.name }]
        }
      ];
      setOrders([...importedOrders, ...orders]);
      alert(`成功匯入 ${importedOrders.length} 筆預約單！`);
      setActiveTab('dispatch');
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const newOrder = {
      id: `ORD-${Date.now()}`,
      ...form,
      price: 1200,
      status: 'pending',
      driverId: null,
      logs: [{ action: '建立訂單', time: new Date().toLocaleString(), user: user.name }]
    };
    
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passenger_name: form.customer,
          passenger_phone: form.phone,
          flight_number: form.flightNumber,
          pickup_time: `${form.date}T${form.time}`,
          pickup_location: form.pickup,
          dropoff_location: form.dropoff
        })
      });
      if (res.ok) {
        setOrders([newOrder, ...orders]);
        setActiveTab('dispatch');
      }
    } catch (error) {
      console.error("Booking failed", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Plus className="text-blue-600" /> 新增預約單</h2>
        <div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.xls,.csv" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm">
            <FileSpreadsheet size={16} /> Excel 批量匯入
          </button>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">訂單來源</label>
            <select className="w-full p-3 border rounded-xl bg-slate-50" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
              <option>電話預約</option>
              <option>LINE@</option>
              <option>官網預定</option>
              <option>同業轉單</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">車型需求</label>
            <select className="w-full p-3 border rounded-xl bg-slate-50" value={form.carType} onChange={e => setForm({...form, carType: e.target.value})}>
              {carTypes.map((type: string) => <option key={type}>{type}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">服務類型</label>
            <select className="w-full p-3 border rounded-xl bg-slate-50" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option>機場送機</option>
              <option>機場接機</option>
              <option>商務包車</option>
              <option>商務用車</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">預約日期</label>
            <input type="date" className="w-full p-3 border rounded-xl" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <div className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <User size={16} /> 客戶資料選擇
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">步驟 1: 選擇公司/單位</label>
              <select className="w-full p-3 border rounded-xl bg-white" value={selectedCompany} onChange={handleCompanyChange}>
                <option value="">-- 請選擇公司 --</option>
                {uniqueCompanies.map(comp => <option key={comp} value={comp}>{comp}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">步驟 2: 選擇客戶姓名</label>
              <select className="w-full p-3 border rounded-xl bg-white disabled:bg-slate-100 disabled:text-slate-400" disabled={!selectedCompany} onChange={handleCustomerChange} defaultValue="">
                <option value="" disabled>{!selectedCompany ? '請先選擇公司' : '-- 請選擇聯絡人 --'}</option>
                {customers.filter((c: any) => (c.company || '其他/個人') === selectedCompany).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">客戶姓名 (自動帶入)</label>
              <input type="text" readOnly className="w-full p-3 border rounded-xl bg-white text-slate-500" value={form.customer} placeholder="選擇上方選單後自動顯示" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">聯絡電話 (自動帶入)</label>
              <input type="text" readOnly className="w-full p-3 border rounded-xl bg-white text-slate-500" value={form.phone} placeholder="選擇上方選單後自動顯示" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400">預約用車時間</label>
            <input type="time" className="w-full p-3 border rounded-xl bg-white" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">乘客人數</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="number" min="1" className="w-full p-3 pl-10 border rounded-xl" value={form.pax} onChange={e => setForm({...form, pax: parseInt(e.target.value)})} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">行李件數</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="number" min="0" className="w-full p-3 pl-10 border rounded-xl" value={form.luggage} onChange={e => setForm({...form, luggage: parseInt(e.target.value)})} />
            </div>
          </div>
        </div>

        {(form.type === '機場接機' || form.type === '機場送機') && (
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
            <div className="text-sm font-bold text-blue-800 flex items-center gap-2">
              <Plane size={18} className="rotate-45" /> 航班資訊
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-blue-800">航班號碼</label>
                <input type="text" className="w-full p-3 border border-blue-200 rounded-xl uppercase font-mono" placeholder="例: BR-123" value={form.flightNumber} onChange={e => setForm({...form, flightNumber: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-blue-800">{form.type === '機場接機' ? '班機抵達時間' : '班機起飛時間'}</label>
                <input type="time" className="w-full p-3 border border-blue-200 rounded-xl" value={form.flightTime} onChange={e => setForm({...form, flightTime: e.target.value})} />
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">上車地點 (A點)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" size={18} />
              <input type="text" className="w-full p-3 pl-10 border rounded-xl" placeholder="例如：台北市、桃園機場" value={form.pickup} onChange={e => setForm({...form, pickup: e.target.value})} />
            </div>
          </div>

          {form.stops.map((stop, idx) => (
            <div key={idx} className="space-y-2">
              <label className="text-sm font-bold text-slate-700">中途停靠</label>
              <div className="relative">
                <Flag className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500" size={18} />
                <input type="text" className="w-full p-3 pl-10 border rounded-xl" placeholder="輸入停靠地址" value={stop} onChange={e => updateStop(idx, e.target.value)} />
              </div>
            </div>
          ))}

          <button type="button" onClick={addStop} className="text-sm text-blue-600 font-bold flex items-center gap-1 hover:underline">
            <Plus size={14} /> 新增停靠點
          </button>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">下車地點 (B點)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-red-600" size={18} />
              <input type="text" className="w-full p-3 pl-10 border rounded-xl" placeholder="例如：桃園機場、台中市" value={form.dropoff} onChange={e => setForm({...form, dropoff: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">加值服務</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.options.sign} onChange={e => setForm({...form, options: {...form.options, sign: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                舉牌服務 (+$100)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.options.babySeat} onChange={e => setForm({...form, options: {...form.options, babySeat: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                安全座椅 (+$200)
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">付款狀態</label>
            <select className="w-full p-3 border rounded-xl bg-white" value={form.paymentStatus} onChange={e => setForm({...form, paymentStatus: e.target.value})}>
              <option>未付款</option>
              <option>已付訂金</option>
              <option>已全額付清</option>
              <option>月結 (企業)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <ClipboardList size={16} /> 訂單備註
          </label>
          <textarea className="w-full p-4 border rounded-xl bg-white h-32 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="請輸入特殊需求或備註事項... (例如：行李過多、有輪椅、指定舉牌內容)" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all">確認建立預約單</button>
      </form>
    </div>
  );
};

const DispatchView = ({ orders, drivers, setCurrentOrderForDispatch, setShowLineModal }: any) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
      <h3 className="font-bold text-lg">待派單任務</h3>
      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
        待處理: {orders.filter((o: any) => o.status === 'pending').length}
      </span>
    </div>
    <OrderTable 
      data={orders.filter((o: any) => o.status === 'pending')} 
      drivers={drivers} 
      showAction={true} 
      onDispatch={(order: any) => { setCurrentOrderForDispatch(order); setShowLineModal(true); }} 
    />
  </div>
);

const OrderManagementView = ({ orders, drivers, setEditingOrder, onDeleteOrder }: any) => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrders = orders.filter((o: any) => {
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchesSearch = 
      o.id.toString().includes(searchQuery) || 
      (o.passenger_name || '').includes(searchQuery) || 
      (o.passenger_phone || '').includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const handleExport = () => {
    const headers = ['訂單編號', '日期', '時間', '客戶', '電話', '起點', '終點', '金額', '狀態'];
    const csvContent = [
      headers.join(','),
      ...filteredOrders.map((o: any) => [
        o.id,
        o.date || o.pickup_time?.split('T')[0],
        o.time || new Date(o.pickup_time).toLocaleTimeString('zh-TW', { hour12: false }),
        o.customer || o.passenger_name,
        o.phone || o.passenger_phone,
        `"${o.pickup || o.pickup_location}"`,
        `"${o.dropoff || o.dropoff_location}"`,
        o.price,
        o.status
      ].join(','))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `訂單報表_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const statuses = [
    { id: 'all', label: '全部' },
    { id: 'pending', label: '待派單' },
    { id: 'assigned', label: '已派單' },
    { id: 'ongoing', label: '行程中' },
    { id: 'completed', label: '已完成' },
    { id: 'cancelled', label: '已取消' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {statuses.map(s => (
          <button
            key={s.id}
            onClick={() => setFilterStatus(s.id)}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${filterStatus === s.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
          <h3 className="font-bold text-lg">訂單清單</h3>
          <div className="flex gap-2 flex-1 md:flex-none">
            <div className="relative flex-1 md:w-64">
              <input 
                type="text" 
                placeholder="搜尋單號、客戶、電話..." 
                className="w-full p-2 pl-8 border rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <Search size={16} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>
            <button onClick={handleExport} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all">
              <Download size={16} /> 匯出
            </button>
          </div>
        </div>
        <OrderTable data={filteredOrders} drivers={drivers} showAction={true} onEdit={setEditingOrder} onDelete={onDeleteOrder} />
      </div>
    </div>
  );
};

const FleetView = ({ fleet, carTypes, setCarTypes }: any) => {
  const [newCarType, setNewCarType] = useState('');

  const handleAddCarType = () => {
    if (!newCarType.trim()) return;
    setCarTypes([...carTypes, newCarType.trim()]);
    setNewCarType('');
  };

  const handleDeleteCarType = (type: string) => {
    setCarTypes(carTypes.filter((t: string) => t !== type));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Vehicle Management */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800">
            <Car className="text-blue-600" /> 車隊車輛管理
          </h3>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
            <Plus size={18} /> 新增車輛
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">車牌號碼</th>
                <th className="px-6 py-4">廠牌型號</th>
                <th className="px-6 py-4">對應車款</th>
                <th className="px-6 py-4">顏色/年份</th>
                <th className="px-6 py-4">狀態</th>
                <th className="px-6 py-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fleet.map((v: any) => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="font-black text-slate-800 tracking-tight">{v.license_plate}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="font-bold text-slate-700 text-sm">{v.brand}</div>
                    <div className="text-xs text-slate-400">{v.model}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="bg-slate-50 border border-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-500 inline-block w-12 text-center leading-tight">
                      {v.type}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-slate-600 font-medium">{v.color}</div>
                    <div className="text-[10px] text-slate-400 font-bold">{v.year}</div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${
                      v.status === '正常' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'
                    }`}>
                      {v.status === '正常' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                      {v.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-colors">
                      <Edit3 size={12} /> 編輯
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Column: Car Type Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 h-fit">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
            <Tag size={24} />
          </div>
          <h3 className="font-bold text-xl text-slate-800 leading-tight">
            車款設定 (Car Types)
          </h3>
        </div>

        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="新增車型名稱..." 
            className="flex-1 p-3 border rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all"
            value={newCarType}
            onChange={(e) => setNewCarType(e.target.value)}
          />
          <button 
            onClick={handleAddCarType}
            className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
          >
            新增
          </button>
        </div>

        <div className="space-y-2">
          {carTypes.map((type: string) => (
            <div key={type} className="group flex items-center justify-between p-4 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all">
              <div className="flex items-center gap-3">
                <Car size={16} className="text-slate-400" />
                <span className="font-bold text-slate-700 text-sm">{type}</span>
              </div>
              <button 
                onClick={() => handleDeleteCarType(type)}
                className="text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DriversView = ({ drivers, setEditingDriver, setShowDriverModal }: any) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {drivers.map((d: any) => (
      <div key={d.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
        <div className="flex justify-between items-start mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl">
            {d.name[0]}
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${d.status === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {d.status === 'available' ? '空閒中' : '行程中'}
          </span>
        </div>
        <h4 className="text-lg font-bold">{d.name}</h4>
        <p className="text-sm text-gray-500 mb-4">{d.phone}</p>
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <Car size={14} /> {d.plate}
          </div>
          <button onClick={() => { setEditingDriver(d); setShowDriverModal(true); }} className="text-indigo-600 text-xs font-bold hover:underline">管理資料</button>
        </div>
      </div>
    ))}
  </div>
);

const CustomersView = ({ customers, customerSearchQuery, setCustomerSearchQuery, setEditingCustomer, setShowCustomerModal, onDeleteCustomer }: any) => {
  const filteredCustomers = customers.filter((c: any) => 
    c.name.includes(customerSearchQuery) || 
    c.phone.includes(customerSearchQuery) || 
    (c.company && c.company.includes(customerSearchQuery))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <User className="text-blue-600" /> 客戶資料管理
        </h2>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="搜尋姓名 / 電話 / 公司..." 
              className="pl-10 pr-4 py-2 border rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none w-80 transition-all"
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => { setEditingCustomer(null); setShowCustomerModal(true); }}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus size={18} /> 新增客戶
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <tr>
              <th className="p-6">群組別</th>
              <th className="p-6">客戶姓名</th>
              <th className="p-6">聯絡電話</th>
              <th className="p-6">紅利點數</th>
              <th className="p-6">公司/單位</th>
              <th className="p-6">地址</th>
              <th className="p-6 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCustomers.map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-6">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    c.group_name === '企業合約' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                    c.group_name === 'VIP' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                    c.group_name === '旅行社' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                    'bg-slate-50 text-slate-600 border border-slate-100'
                  }`}>
                    <Tag size={12} /> {c.group_name}
                  </span>
                </td>
                <td className="p-6">
                  <div className="font-bold text-slate-800">{c.name}</div>
                </td>
                <td className="p-6">
                  <div className="font-mono text-sm text-slate-600">{c.phone}</div>
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-1 font-bold text-orange-500">
                    <DollarSign size={14} />
                    {c.points} P
                  </div>
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building2 size={14} className="text-slate-400" />
                    <span className="font-medium">{c.company}</span>
                  </div>
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-2 text-slate-500 text-sm max-w-xs">
                    <Home size={14} className="flex-shrink-0 text-slate-400" />
                    <span className="truncate">{c.address}</span>
                  </div>
                </td>
                <td className="p-6 text-center">
                  <div className="flex justify-center gap-2">
                    <button 
                      onClick={() => { setEditingCustomer(c); setShowCustomerModal(true); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                    >
                      <Edit3 size={14} /> 編輯
                    </button>
                    <button 
                      onClick={() => onDeleteCustomer(c.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={14} /> 刪除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SettingsView = ({ rates, setRates, routeRates, setRouteRates, carTypes }: any) => {
  const [newRoute, setNewRoute] = useState({ 
    startCity: '', 
    startDistrict: '', 
    endCity: '', 
    endDistrict: '', 
    carType: carTypes[0] || '四人座轎車',
    price: '' 
  });

  const handleAddRoute = async () => {
    if (!newRoute.startCity || !newRoute.endCity || !newRoute.price) return;
    
    const payload = {
      start_city: newRoute.startCity,
      start_district: newRoute.startDistrict,
      end_city: newRoute.endCity,
      end_district: newRoute.endDistrict,
      car_type: newRoute.carType,
      price: parseInt(newRoute.price)
    };

    try {
      const res = await fetch('/api/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setRouteRates([...routeRates, { 
          id: Date.now(), 
          start_city: newRoute.startCity,
          start_district: newRoute.startDistrict,
          end_city: newRoute.endCity,
          end_district: newRoute.endDistrict,
          car_type: newRoute.carType,
          price: parseInt(newRoute.price)
        }]);
        setNewRoute({ 
          startCity: '', 
          startDistrict: '', 
          endCity: '', 
          endDistrict: '', 
          carType: carTypes[0] || '四人座轎車', 
          price: '' 
        });
      }
    } catch (error) {
      console.error("Failed to add rate", error);
    }
  };

  const handleDeleteRoute = (id: number) => {
    setRouteRates(routeRates.filter((r: any) => r.id !== id));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Left Column: Route Pricing */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-blue-600">
          <Map size={20} /> A點到B點 路線計價
        </h3>

        <div className="bg-slate-50 p-4 rounded-lg mb-6 space-y-3">
          <h4 className="text-sm font-bold text-slate-700">新增路線</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">起點縣市</label>
              <input
                type="text"
                placeholder="例如: 台北市"
                className="w-full p-2 border rounded-lg text-sm bg-white"
                value={newRoute.startCity}
                onChange={e => setNewRoute({ ...newRoute, startCity: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">起點區域</label>
              <input
                type="text"
                placeholder="例如: 信義區"
                className="w-full p-2 border rounded-lg text-sm bg-white"
                value={newRoute.startDistrict}
                onChange={e => setNewRoute({ ...newRoute, startDistrict: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">終點縣市</label>
              <input
                type="text"
                placeholder="例如: 桃園市"
                className="w-full p-2 border rounded-lg text-sm bg-white"
                value={newRoute.endCity}
                onChange={e => setNewRoute({ ...newRoute, endCity: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">終點區域</label>
              <input
                type="text"
                placeholder="例如: 大園區"
                className="w-full p-2 border rounded-lg text-sm bg-white"
                value={newRoute.endDistrict}
                onChange={e => setNewRoute({ ...newRoute, endDistrict: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">適用車款</label>
              <select
                className="w-full p-2 border rounded-lg text-sm bg-white"
                value={newRoute.carType}
                onChange={e => setNewRoute({ ...newRoute, carType: e.target.value })}
              >
                {carTypes.map((type: string) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">路線金額</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  placeholder="金額"
                  className="w-full pl-7 p-2 border rounded-lg text-sm bg-white"
                  value={newRoute.price}
                  onChange={e => setNewRoute({ ...newRoute, price: e.target.value })}
                />
              </div>
            </div>
          </div>
          <button
            onClick={handleAddRoute}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors mt-2"
          >
            新增路線費率
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="p-2">起點 (縣市/區)</th>
                <th className="p-2">終點 (縣市/區)</th>
                <th className="p-2">車款</th>
                <th className="p-2">金額</th>
                <th className="p-2 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {routeRates.map((route: any) => (
                <tr key={route.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2 font-medium text-slate-700">
                    {route.start_city}{route.start_district && ` / ${route.start_district}`}
                  </td>
                  <td className="p-2 font-medium text-slate-700">
                    {route.end_city}{route.end_district && ` / ${route.end_district}`}
                  </td>
                  <td className="p-2 text-slate-500">{route.car_type}</td>
                  <td className="p-2 font-bold text-blue-600">${route.price}</td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleDeleteRoute(route.id)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Column: Surcharges and Positioning */}
      <div className="space-y-8">
        {/* Surcharge Settings */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-700">
            <Settings size={20} /> 加成費率設定
          </h3>
          <div className="space-y-6">
            {[
              { label: '基本起跳費 (若無匹配路線)', key: 'baseFare' },
              { label: '夜間加成 (22:00-06:00)', key: 'nightSurcharge' },
              { label: '停靠加點費 (每點)', key: 'stopFee' },
              { label: '舉牌服務費', key: 'signFee' },
              { label: '安全座椅費', key: 'babySeatFee' }
            ].map(item => (
              <div key={item.key} className="flex justify-between items-center">
                <span className="text-slate-600 font-medium text-sm">{item.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    className="w-28 p-2 border rounded-lg text-right font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={rates[item.key]}
                    onChange={e => setRates({ ...rates, [item.key]: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Positioning Settings */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-purple-600">
            <Map size={20} /> 定位系統設定
          </h3>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium text-sm">定位訊號來源</span>
              <select className="p-2 border rounded-lg text-sm bg-slate-50 focus:bg-white outline-none w-48">
                <option>手機門號定位 (LBS/GPS)</option>
                <option>車載 GPS 裝置</option>
                <option>司機 App 回報</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium text-sm">訊號更新頻率</span>
              <select className="p-2 border rounded-lg text-sm bg-slate-50 focus:bg-white outline-none w-48">
                <option>即時 (Real-time)</option>
                <option>每 30 秒</option>
                <option>每 5 分鐘</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Components ---

const StatCard = ({ title, value, icon, color }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
    <div className={`p-4 rounded-full text-white ${color} shadow-lg shadow-black/10`}>
      {icon}
    </div>
    <div>
      <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</div>
      <div className="text-2xl font-black text-slate-800">{value}</div>
    </div>
  </div>
);

const OrderTable = ({ data, drivers, showAction, onDispatch, onEdit, onDelete }: any) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
        <tr>
          <th className="p-4 border-b">預約時間</th>
          <th className="p-4 border-b">行程</th>
          <th className="p-4 border-b">客戶</th>
          <th className="p-4 border-b">金額</th>
          <th className="p-4 border-b">狀態</th>
          {showAction && <th className="p-4 border-b">操作</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {data.map((order: any) => (
          <tr key={order.id} className="hover:bg-slate-50">
            <td className="p-4 font-bold text-sm">
              <div className="flex flex-col">
                <span>{new Date(order.pickup_time).toLocaleDateString('zh-TW')}</span>
                <span className="text-indigo-600">{new Date(order.pickup_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              </div>
            </td>
            <td className="p-4 text-xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="bg-slate-100 px-1 rounded text-[10px]">起</span> {order.pickup_location}
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="bg-slate-100 px-1 rounded text-[10px]">迄</span> {order.dropoff_location || '包車'}
                </div>
              </div>
            </td>
            <td className="p-4 font-bold text-sm">{order.passenger_name}</td>
            <td className="p-4 font-mono text-sm">${order.price}</td>
            <td className="p-4">
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                order.status === 'assigned' ? 'bg-green-100 text-green-700' : 
                order.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                order.status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
                order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {
                  order.status === 'assigned' ? '已派單' : 
                  order.status === 'pending' ? '待派單' :
                  order.status === 'ongoing' ? '行程中' :
                  order.status === 'completed' ? '已完成' :
                  order.status === 'cancelled' ? '已取消' : order.status
                }
              </span>
            </td>
            {showAction && (
              <td className="p-4">
                <div className="flex gap-2">
                  {order.status === 'pending' && onDispatch && <button onClick={() => onDispatch(order)} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm" title="派單"><Send size={14} /></button>}
                  {onEdit && <button onClick={() => onEdit(order)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all" title="編輯"><Edit3 size={14} /></button>}
                  {onDelete && <button onClick={() => onDelete(order.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all" title="刪除"><Trash2 size={14} /></button>}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const LoginView = ({ onLogin, setAppRole }: any) => (
  <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
      <div className="bg-yellow-500 p-8 text-center">
        <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Car size={32} className="text-slate-900" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">SkyLink Dispatch</h1>
        <p className="text-slate-900/70 font-bold mt-2">接送派遣管理系統</p>
      </div>
      <div className="p-8 space-y-6">
        <button onClick={() => onLogin({ name: '管理員', role: ROLES.ADMIN })} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-lg">管理員登入</button>
        <div className="flex gap-4">
          <button onClick={() => setAppRole('customer')} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50">客戶預約端</button>
          <button onClick={() => setAppRole('driver')} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50">司機端 APP</button>
        </div>
      </div>
    </div>
  </div>
);

const CustomerPortal = ({ setAppRole, rates, routeRates, carTypes }: any) => {
  const [member, setMember] = useState<any>(null);
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [history, setHistory] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'new' | 'history'>('new');
  const [booking, setBooking] = useState({
    passenger_name: '', 
    passenger_phone: '', 
    flight_number: '', 
    flight_time: '',
    pickup_time: '', 
    pickup_location: '', 
    dropoff_location: '', 
    service_type: '接機',
    stops: [] as string[],
    child_seats: 0,
    meet_greet: false,
    notes: '',
    passenger_count: 1,
    luggage_count: 0,
    car_type: '四人座轎車'
  });

  const calculatePrice = useMemo(() => {
    let price = rates.baseFare || 0;
    
    // Check for route specific rates
    if (booking.pickup_location && booking.dropoff_location) {
      const route = routeRates.find((r: any) => 
        (r.pickup === booking.pickup_location && r.dropoff === booking.dropoff_location) ||
        (r.pickup === booking.dropoff_location && r.dropoff === booking.pickup_location)
      );
      if (route) {
        price = route.price;
      }
    }

    // Add surcharges
    price += (booking.child_seats * (rates.babySeatFee || 200));
    if (booking.meet_greet) price += (rates.signFee || 100);
    price += (booking.stops.length * (rates.stopFee || 300));

    return price;
  }, [booking, rates, routeRates]);

  const addStop = () => {
    setBooking(prev => ({ ...prev, stops: [...prev.stops, ''] }));
  };

  const updateStop = (index: number, value: string) => {
    const newStops = [...booking.stops];
    newStops[index] = value;
    setBooking(prev => ({ ...prev, stops: newStops }));
  };

  const removeStop = (index: number) => {
    setBooking(prev => ({ ...prev, stops: prev.stops.filter((_, i) => i !== index) }));
  };

  useEffect(() => {
    if (member) {
      fetchHistory();
      setBooking(prev => ({
        ...prev,
        passenger_name: member.name,
        passenger_phone: member.phone
      }));
    }
  }, [member]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/member/${member.id}/bookings`);
      setHistory(await res.json());
    } catch (error) {
      console.error("Failed to fetch history", error);
    }
  };

  const handleLogin = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/member/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      if (res.ok) {
        setMember(await res.json());
      } else {
        alert('電話或密碼錯誤');
      }
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...booking,
          stops: booking.stops.filter(s => s.trim() !== '').join(' | '),
          meet_greet: booking.meet_greet ? 1 : 0,
          customer_id: member?.id,
          price: calculatePrice
        })
      });
      if (res.ok) {
        alert('預約成功！');
        fetchHistory();
        setActiveSubTab('history');
      }
    } catch (error) {
      console.error("Booking failed", error);
    }
  };

  if (!member) {
    return (
      <div className="min-h-screen bg-indigo-600 p-4 md:p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8">
          <div className="text-center mb-8">
            <Plane className="w-12 h-12 mx-auto mb-4 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-800">SkyLink 會員登入</h1>
            <p className="text-slate-400 text-sm mt-2">請輸入您的註冊電話與密碼</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                required 
                type="text" 
                placeholder="手機號碼" 
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                value={loginForm.phone} 
                onChange={e => setLoginForm({...loginForm, phone: e.target.value})} 
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                required 
                type="password" 
                placeholder="登入密碼" 
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                value={loginForm.password} 
                onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
              />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
              登入系統
            </button>
          </form>
          <div className="mt-8 text-center">
            <button onClick={() => setAppRole('erp')} className="text-slate-400 hover:text-indigo-600 text-sm font-medium">返回管理後台</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-100 p-4 md:p-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold shadow-lg shadow-indigo-100">
              {member.name[0]}
            </div>
            <div>
              <h3 className="font-bold text-slate-800">{member.name} 先生/小姐</h3>
              <div className="flex items-center gap-2 text-xs font-bold text-orange-500">
                <DollarSign size={12} />
                紅利點數：{member.points} P
              </div>
            </div>
          </div>
          <button onClick={() => setMember(null)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
            <button 
              onClick={() => setActiveSubTab('new')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeSubTab === 'new' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
            >
              我要預約
            </button>
            <button 
              onClick={() => setActiveSubTab('history')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeSubTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
            >
              歷史訂單
            </button>
          </div>

          {activeSubTab === 'new' ? (
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
              <div className="bg-indigo-600 p-8 text-white">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Plus size={24} /> 填寫預約資料
                </h2>
                <p className="text-indigo-100 text-sm mt-1">請確認您的行程資訊，我們將儘速為您安排車輛</p>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500">用車選項</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['接機', '送機', '計時包車'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBooking({ ...booking, service_type: type })}
                        className={`py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                          booking.service_type === type 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' 
                          : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">乘車人姓名</label>
                    <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={booking.passenger_name} onChange={e => setBooking({...booking, passenger_name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">聯絡電話</label>
                    <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={booking.passenger_phone} onChange={e => setBooking({...booking, passenger_phone: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">預約時間</label>
                    <input required type="datetime-local" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={booking.pickup_time} onChange={e => setBooking({...booking, pickup_time: e.target.value})} />
                  </div>
                  {booking.service_type !== '計時包車' && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500">航班編號 / 班機時間 (選填)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="航班: JX-800" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={booking.flight_number} onChange={e => setBooking({...booking, flight_number: e.target.value})} />
                        <input type="time" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={booking.flight_time} onChange={e => setBooking({...booking, flight_time: e.target.value})} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500">上車地點</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input required type="text" placeholder="請輸入詳細地址" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={booking.pickup_location} onChange={e => setBooking({...booking, pickup_location: e.target.value})} />
                  </div>
                </div>
                
                {booking.stops.map((stop, index) => (
                  <div key={index} className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 flex justify-between">
                      停靠點 {index + 1}
                      <button type="button" onClick={() => removeStop(index)} className="text-red-500 text-xs hover:underline">移除</button>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input required type="text" placeholder="請輸入停靠點地址" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={stop} onChange={e => updateStop(index, e.target.value)} />
                    </div>
                  </div>
                ))}
                
                <button type="button" onClick={addStop} className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:underline">
                  <Plus size={16} /> 新增停靠點
                </button>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500">下車地點</label>
                  <div className="relative">
                    <Flag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input required type="text" placeholder="請輸入詳細地址" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={booking.dropoff_location} onChange={e => setBooking({...booking, dropoff_location: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">乘車人數</label>
                    <input type="number" min="1" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={booking.passenger_count} onChange={e => setBooking({...booking, passenger_count: parseInt(e.target.value) || 1})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">行李件數</label>
                    <input type="number" min="0" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={booking.luggage_count} onChange={e => setBooking({...booking, luggage_count: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">安全座椅 (+${rates.babySeatFee})</label>
                    <input type="number" min="0" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={booking.child_seats} onChange={e => setBooking({...booking, child_seats: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">舉牌服務 (+${rates.signFee})</label>
                    <button
                      type="button"
                      onClick={() => setBooking({ ...booking, meet_greet: !booking.meet_greet })}
                      className={`w-full py-4 rounded-2xl font-bold text-sm transition-all border-2 ${
                        booking.meet_greet 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' 
                        : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'
                      }`}
                    >
                      {booking.meet_greet ? '需要' : '不需要'}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">基本車資</span>
                    <span className="font-mono font-bold text-slate-700">${calculatePrice - (booking.child_seats * rates.babySeatFee) - (booking.meet_greet ? rates.signFee : 0) - (booking.stops.length * rates.stopFee)}</span>
                  </div>
                  {booking.child_seats > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">安全座椅 x {booking.child_seats}</span>
                      <span className="font-mono font-bold text-slate-700">+${booking.child_seats * rates.babySeatFee}</span>
                    </div>
                  )}
                  {booking.meet_greet && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">舉牌服務</span>
                      <span className="font-mono font-bold text-slate-700">+${rates.signFee}</span>
                    </div>
                  )}
                  {booking.stops.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">停靠點 x {booking.stops.length}</span>
                      <span className="font-mono font-bold text-slate-700">+${booking.stops.length * rates.stopFee}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-slate-800">預估總額</span>
                    <span className="text-2xl font-black text-indigo-600 font-mono">${calculatePrice}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500">訂單備註</label>
                  <textarea 
                    placeholder="如有特殊需求請在此說明..." 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24" 
                    value={booking.notes} 
                    onChange={e => setBooking({...booking, notes: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
                  立即預約
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((o: any) => (
                <div key={o.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">預約單號 #{o.id}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{new Date(o.pickup_time).toLocaleDateString('zh-TW')}</span>
                        <span className="font-bold text-indigo-600">{new Date(o.pickup_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                      o.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                      o.status === 'cancelled' ? 'bg-red-50 text-red-600 border border-red-100' :
                      'bg-blue-50 text-blue-600 border border-blue-100'
                    }`}>
                      {o.status === 'pending' ? '待指派' : 
                       o.status === 'assigned' ? '已指派' :
                       o.status === 'ongoing' ? '行程中' :
                       o.status === 'completed' ? '已完成' : '已取消'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">起點</span>
                      <p className="text-xs text-slate-600 font-medium truncate">{o.pickup_location}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">終點</span>
                      <p className="text-xs text-slate-600 font-medium truncate">{o.dropoff_location}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Car size={14} />
                      {o.vehicle_model || '尚未指派車輛'}
                    </div>
                    <div className="font-bold text-slate-800">
                      $ {o.price || 0}
                    </div>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-slate-200">
                  <History className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                  <p className="text-slate-400 font-medium">目前尚無歷史訂單</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <div className="p-8 text-center">
        <button onClick={() => setAppRole('erp')} className="text-slate-400 hover:text-indigo-600 text-sm font-medium">返回管理後台</button>
      </div>
    </div>
  );
};

const DriverApp = ({ drivers, orders, setOrders, setAppRole }: any) => {
  const [driver, setDriver] = useState<any>(null);
  const [myBookings, setMyBookings] = useState<any[]>([]);

  useEffect(() => {
    if (driver) {
      fetchMyBookings();
    }
  }, [driver]);

  const fetchMyBookings = async () => {
    try {
      const res = await fetch(`/api/driver/${driver.id}/bookings`);
      setMyBookings(await res.json());
    } catch (error) {
      console.error("Failed to fetch driver bookings", error);
    }
  };

  const updateStatus = async (bookingId: number, status: string) => {
    await fetch(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchMyBookings();
  };

  if (!driver) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-center mb-8">司機端 APP 登入</h2>
          <div className="space-y-4">
            {drivers.map((d: any) => (
              <button key={d.id} onClick={() => setDriver(d)} className="w-full p-4 border rounded-2xl hover:bg-slate-50 text-left font-bold flex justify-between items-center">
                {d.name} <ChevronRight size={18} />
              </button>
            ))}
          </div>
          <button onClick={() => setAppRole('erp')} className="w-full mt-8 text-slate-400 text-sm">返回管理後台</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white p-6 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">{driver.name[0]}</div>
          <h3 className="font-bold">{driver.name}</h3>
        </div>
        <button onClick={() => setDriver(null)} className="text-slate-400"><LogOut size={20} /></button>
      </header>
      <main className="p-4 space-y-4">
        <h2 className="text-lg font-bold">今日任務</h2>
        {myBookings.map((o: any) => (
          <div key={o.id} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <div className="flex justify-between">
              <span className="font-bold text-indigo-600">{new Date(o.pickup_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${o.status === 'assigned' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                {o.status === 'assigned' ? '已指派' : o.status}
              </span>
            </div>
            <p className="text-sm font-bold">{o.passenger_name}</p>
            <div className="text-xs text-slate-500 space-y-1">
              <p>起: {o.pickup_location}</p>
              <p>迄: {o.dropoff_location}</p>
            </div>
            <div className="pt-4 border-t flex gap-2">
              {o.status === 'assigned' && <button onClick={() => updateStatus(o.id, 'ongoing')} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-bold text-sm">開始行程</button>}
              {o.status === 'ongoing' && <button onClick={() => updateStatus(o.id, 'completed')} className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold text-sm">完成行程</button>}
            </div>
          </div>
        ))}
        {myBookings.length === 0 && <div className="text-center py-20 text-slate-400">目前沒有任務</div>}
      </main>
    </div>
  );
};

const DispatchModal = ({ order, drivers, getDriverEligibility, handleDispatch, onClose }: any) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
      <div className="bg-[#06C755] p-4 text-white flex justify-between items-center">
        <h3 className="font-bold flex items-center gap-2"><MessageSquare /> 派單至司機端</h3>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="p-6 space-y-4">
        {drivers.map((d: any) => {
          const { eligible, reason } = getDriverEligibility(d);
          return (
            <button
              key={d.id}
              disabled={!eligible}
              onClick={() => handleDispatch(order.id, d.id)}
              className="w-full flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 disabled:opacity-50"
            >
              <div>
                <p className="font-bold">{d.name}</p>
                <p className="text-xs text-slate-500">{d.car}</p>
              </div>
              <span className="text-xs font-bold text-slate-400">{reason}</span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

const OrderEditModal = ({ order, setOrder, onSave, carTypes, onClose }: any) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
      <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
        <h3 className="font-bold">編輯訂單 - {order.id}</h3>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={18} /></button>
      </div>
      <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">乘車日期</label>
            <input type="date" className="w-full p-2 border rounded-xl bg-slate-50" value={order.date || order.pickup_time?.split('T')[0]} onChange={e => setOrder({...order, date: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">乘車時間</label>
            <input type="time" className="w-full p-2 border rounded-xl bg-slate-50" value={order.time || (order.pickup_time ? new Date(order.pickup_time).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '')} onChange={e => setOrder({...order, time: e.target.value})} />
          </div>
        </div>

        {order.service_type !== '計時包車' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">航班編號</label>
              <input type="text" className="w-full p-2 border rounded-xl bg-slate-50" value={order.flight_number || ''} onChange={e => setOrder({...order, flight_number: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">班機時間</label>
              <input type="time" className="w-full p-2 border rounded-xl bg-slate-50" value={order.flight_time || ''} onChange={e => setOrder({...order, flight_time: e.target.value})} />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">上車地點</label>
          <input type="text" className="w-full p-2 border rounded-xl bg-slate-50" value={order.pickup_location || order.pickup} onChange={e => setOrder({...order, pickup_location: e.target.value})} />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">停靠點</label>
          <input type="text" className="w-full p-2 border rounded-xl bg-slate-50" value={order.stops || ''} onChange={e => setOrder({...order, stops: e.target.value})} placeholder="停靠點 1 | 停靠點 2..." />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">下車地點</label>
          <input type="text" className="w-full p-2 border rounded-xl bg-slate-50" value={order.dropoff_location || order.dropoff} onChange={e => setOrder({...order, dropoff_location: e.target.value})} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">乘客人數</label>
            <input type="number" className="w-full p-2 border rounded-xl bg-slate-50" value={order.passenger_count || 1} onChange={e => setOrder({...order, passenger_count: parseInt(e.target.value) || 1})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">行李件數</label>
            <input type="number" className="w-full p-2 border rounded-xl bg-slate-50" value={order.luggage_count || 0} onChange={e => setOrder({...order, luggage_count: parseInt(e.target.value) || 0})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">安全座椅</label>
            <input type="number" className="w-full p-2 border rounded-xl bg-slate-50" value={order.child_seats || 0} onChange={e => setOrder({...order, child_seats: parseInt(e.target.value) || 0})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">舉牌服務</label>
            <select className="w-full p-2 border rounded-xl bg-slate-50" value={order.meet_greet ? '1' : '0'} onChange={e => setOrder({...order, meet_greet: e.target.value === '1'})}>
              <option value="0">不需要</option>
              <option value="1">需要</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">訂單備註</label>
          <textarea className="w-full p-2 border rounded-xl bg-slate-50 h-20 text-sm" value={order.notes || ''} onChange={e => setOrder({...order, notes: e.target.value})} placeholder="備註..." />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button onClick={onClose} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">取消</button>
          <button onClick={() => onSave(order)} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">儲存變更</button>
        </div>
      </div>
    </div>
  </div>
);

const CustomerModal = ({ customer, onSave, onClose }: any) => {
  const [form, setForm] = useState(customer || {
    name: '',
    phone: '',
    email: '',
    company: '',
    group_name: '一般客戶',
    address: '',
    notes: '',
    password: '123456',
    points: 0
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User /> {customer ? '編輯客戶資料' : '新增客戶資料'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X /></button>
        </div>
        <div className="p-8 max-h-[80vh] overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">客戶姓名</label>
              <input required type="text" className="w-full p-3 border rounded-xl bg-slate-50" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">聯絡電話</label>
              <input required type="text" className="w-full p-3 border rounded-xl bg-slate-50" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">登入密碼</label>
              <input type="text" className="w-full p-3 border rounded-xl bg-slate-50" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">紅利點數</label>
              <input type="number" className="w-full p-3 border rounded-xl bg-slate-50" value={form.points} onChange={e => setForm({...form, points: parseInt(e.target.value) || 0})} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">客戶群組</label>
              <select className="w-full p-3 border rounded-xl bg-slate-50" value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})}>
                <option>一般客戶</option>
                <option>VIP</option>
                <option>企業合約</option>
                <option>旅行社</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">公司名稱</label>
              <input type="text" className="w-full p-3 border rounded-xl bg-slate-50" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">電子郵件</label>
            <input type="email" className="w-full p-3 border rounded-xl bg-slate-50" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">通訊地址</label>
            <input type="text" className="w-full p-3 border rounded-xl bg-slate-50" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">備註事項</label>
            <textarea className="w-full p-3 border rounded-xl bg-slate-50 h-24" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}></textarea>
          </div>
        </div>
        <div className="p-6 bg-slate-50 border-t flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all">取消</button>
          <button onClick={() => onSave(form)} className="px-8 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">儲存資料</button>
        </div>
      </motion.div>
    </div>
  );
};

export default App;

import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("airport_erp.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'available', -- available, busy, offline
    license_plate TEXT,
    password TEXT DEFAULT '123456'
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    type TEXT NOT NULL,
    license_plate TEXT UNIQUE NOT NULL,
    color TEXT,
    year TEXT,
    status TEXT DEFAULT '正常'
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    company TEXT,
    group_name TEXT,
    address TEXT,
    notes TEXT,
    password TEXT,
    points INTEGER DEFAULT 0,
    total_bookings INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_city TEXT NOT NULL,
    start_district TEXT NOT NULL,
    end_city TEXT NOT NULL,
    end_district TEXT NOT NULL,
    car_type TEXT NOT NULL,
    price INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    passenger_name TEXT NOT NULL,
    passenger_phone TEXT NOT NULL,
    flight_number TEXT,
    flight_time TEXT,
    pickup_time DATETIME NOT NULL,
    pickup_location TEXT NOT NULL,
    dropoff_location TEXT NOT NULL,
    stops TEXT,
    child_seats INTEGER DEFAULT 0,
    meet_greet INTEGER DEFAULT 0,
    notes TEXT,
    passenger_count INTEGER DEFAULT 1,
    luggage_count INTEGER DEFAULT 0,
    service_type TEXT, -- 接機, 送機, 計時包車
    driver_id INTEGER,
    vehicle_id INTEGER,
    customer_id INTEGER,
    price INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending, assigned, ongoing, completed, cancelled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES drivers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
`);

// Migration: Add password and points to customers if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(customers)").all() as any[];
const hasPassword = tableInfo.some(col => col.name === 'password');
const hasPoints = tableInfo.some(col => col.name === 'points');

if (!hasPassword) {
  try { db.exec("ALTER TABLE customers ADD COLUMN password TEXT"); } catch(e) {}
}
if (!hasPoints) {
  try { db.exec("ALTER TABLE customers ADD COLUMN points INTEGER DEFAULT 0"); } catch(e) {}
}

// Migration: Add new columns to bookings if they don't exist
const bookingTableInfo = db.prepare("PRAGMA table_info(bookings)").all() as any[];
const bookingCols = bookingTableInfo.map(col => col.name);
const newBookingCols = [
  { name: 'flight_time', type: 'TEXT' },
  { name: 'stops', type: 'TEXT' },
  { name: 'child_seats', type: 'INTEGER DEFAULT 0' },
  { name: 'meet_greet', type: 'INTEGER DEFAULT 0' },
  { name: 'notes', type: 'TEXT' },
  { name: 'passenger_count', type: 'INTEGER DEFAULT 1' },
  { name: 'luggage_count', type: 'INTEGER DEFAULT 0' }
];

newBookingCols.forEach(col => {
  if (!bookingCols.includes(col.name)) {
    try { db.exec(`ALTER TABLE bookings ADD COLUMN ${col.name} ${col.type}`); } catch(e) {}
  }
});

// Ensure existing customers have a default password if missing
db.exec("UPDATE customers SET password = '123456' WHERE password IS NULL");

// Seed data if empty
const driverCount = db.prepare("SELECT COUNT(*) as count FROM drivers").get() as { count: number };
if (driverCount.count === 0) {
  db.prepare("INSERT INTO drivers (name, phone, status, license_plate) VALUES (?, ?, ?, ?)").run("張小明", "0912345678", "available", "ABC-1234");
  db.prepare("INSERT INTO drivers (name, phone, status, license_plate) VALUES (?, ?, ?, ?)").run("李大華", "0922111222", "available", "XYZ-5678");
  
  db.prepare("INSERT INTO vehicles (brand, model, type, license_plate, color, year, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run("Toyota", "Camry", "四人座轎車", "RAA-1234", "白", "2020", "正常");
  db.prepare("INSERT INTO vehicles (brand, model, type, license_plate, color, year, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run("Benz", "V250d", "七人座商務", "KBB-9999", "黑", "2022", "正常");
  db.prepare("INSERT INTO vehicles (brand, model, type, license_plate, color, year, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run("Toyota", "Alphard", "保母車", "TCC-8888", "黑", "2021", "保養中");
  db.prepare("INSERT INTO vehicles (brand, model, type, license_plate, color, year, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run("Tesla", "Model 3", "豪華進口車", "EAA-1122", "白", "2023", "正常");

  db.prepare("INSERT INTO rates (start_city, start_district, end_city, end_district, car_type, price) VALUES (?, ?, ?, ?, ?, ?)").run("台北市", "信義區", "桃園市", "大園區", "四人座轎車", 1200);
  db.prepare("INSERT INTO rates (start_city, start_district, end_city, end_district, car_type, price) VALUES (?, ?, ?, ?, ?, ?)").run("新北市", "板橋區", "桃園市", "大園區", "四人座轎車", 1300);
  db.prepare("INSERT INTO rates (start_city, start_district, end_city, end_district, car_type, price) VALUES (?, ?, ?, ?, ?, ?)").run("台北市", "信義區", "桃園市", "大園區", "七人座商務", 1500);

  db.prepare("INSERT INTO customers (name, phone, company, group_name, address, notes, password, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("王經理", "0910-000-111", "台積電", "企業合約", "新竹科學園區力行六路1號", "喜歡安靜，不聊天", "123456", 500);
  db.prepare("INSERT INTO customers (name, phone, company, group_name, address, notes, password, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("李小姐", "0920-222-333", "個人戶", "一般客戶", "台北市信義區松仁路100號", "有嬰兒座椅需求", "123456", 100);
  db.prepare("INSERT INTO customers (name, phone, company, group_name, address, notes, password, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("張總裁", "0933-444-555", "富邦金控", "VIP", "台北市大安區仁愛路四段", "指定 Benz 車款", "123456", 2000);
  db.prepare("INSERT INTO customers (name, phone, company, group_name, address, notes, password, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("陳導遊", "0955-111-222", "雄獅旅遊", "旅行社", "台北市內湖區石潭路151號", "常有團體接送", "123456", 300);
  db.prepare("INSERT INTO customers (name, phone, company, group_name, address, notes, password, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("劉秘書", "0910-888-999", "台積電", "企業合約", "新竹科學園區力行六路1號", "聯繫窗口", "123456", 150);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/drivers", (req, res) => {
    const drivers = db.prepare("SELECT * FROM drivers").all();
    res.json(drivers);
  });

  app.get("/api/vehicles", (req, res) => {
    const vehicles = db.prepare("SELECT * FROM vehicles").all();
    res.json(vehicles);
  });

  app.get("/api/bookings", (req, res) => {
    const bookings = db.prepare(`
      SELECT b.*, d.name as driver_name, v.model as vehicle_model 
      FROM bookings b
      LEFT JOIN drivers d ON b.driver_id = d.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      ORDER BY pickup_time ASC
    `).all();
    res.json(bookings);
  });

  app.post("/api/bookings", (req, res) => {
    const { 
      passenger_name, passenger_phone, flight_number, flight_time, 
      pickup_time, pickup_location, dropoff_location, stops,
      child_seats, meet_greet, notes, passenger_count, luggage_count,
      service_type, customer_id 
    } = req.body;
    
    const info = db.prepare(`
      INSERT INTO bookings (
        passenger_name, passenger_phone, flight_number, flight_time, 
        pickup_time, pickup_location, dropoff_location, stops,
        child_seats, meet_greet, notes, passenger_count, luggage_count,
        service_type, customer_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      passenger_name, passenger_phone, flight_number, flight_time, 
      pickup_time, pickup_location, dropoff_location, stops,
      child_seats, meet_greet, notes, passenger_count, luggage_count,
      service_type, customer_id
    );
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/bookings/:id/dispatch", (req, res) => {
    const { id } = req.params;
    const { driver_id, vehicle_id } = req.body;
    db.prepare("UPDATE bookings SET driver_id = ?, vehicle_id = ?, status = 'assigned' WHERE id = ?")
      .run(driver_id, vehicle_id, id);
    res.json({ success: true });
  });

  app.get("/api/customers", (req, res) => {
    const customers = db.prepare("SELECT * FROM customers").all();
    res.json(customers);
  });

  app.post("/api/customers", (req, res) => {
    const { name, phone, email, company, group_name, address, notes, password, points } = req.body;
    const info = db.prepare(`
      INSERT INTO customers (name, phone, email, company, group_name, address, notes, password, points)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, phone, email, company, group_name, address, notes, password || '123456', points || 0);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    const { name, phone, email, company, group_name, address, notes, password, points } = req.body;
    db.prepare(`
      UPDATE customers 
      SET name = ?, phone = ?, email = ?, company = ?, group_name = ?, address = ?, notes = ?, password = ?, points = ?
      WHERE id = ?
    `).run(name, phone, email, company, group_name, address, notes, password, points, id);
    res.json({ success: true });
  });

  app.delete("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM customers WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/member/login", (req, res) => {
    const { phone, password } = req.body;
    // Normalize phone: remove non-digits
    const normalizedPhone = phone.replace(/\D/g, '');
    
    const customers = db.prepare("SELECT * FROM customers WHERE password = ?").all(password);
    const customer = customers.find(c => c.phone.replace(/\D/g, '') === normalizedPhone);

    if (customer) {
      res.json(customer);
    } else {
      res.status(401).json({ error: "電話或密碼錯誤" });
    }
  });

  app.get("/api/member/:id/bookings", (req, res) => {
    const { id } = req.params;
    const bookings = db.prepare(`
      SELECT b.*, v.model as vehicle_model 
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      WHERE b.customer_id = ?
      ORDER BY pickup_time DESC
    `).all(id);
    res.json(bookings);
  });

  app.get("/api/rates", (req, res) => {
    const rates = db.prepare("SELECT * FROM rates").all();
    res.json(rates);
  });

  app.post("/api/rates", (req, res) => {
    const { start_city, start_district, end_city, end_district, car_type, price } = req.body;
    db.prepare("INSERT INTO rates (start_city, start_district, end_city, end_district, car_type, price) VALUES (?, ?, ?, ?, ?, ?)")
      .run(start_city, start_district, end_city, end_district, car_type, price);
    res.json({ success: true });
  });

  app.post("/api/driver/login", (req, res) => {
    const { phone, password } = req.body;
    const normalizedPhone = phone.replace(/\D/g, '');
    
    const drivers = db.prepare("SELECT * FROM drivers WHERE password = ?").all(password);
    const driver = drivers.find(d => d.phone.replace(/\D/g, '') === normalizedPhone);

    if (driver) {
      res.json(driver);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/driver/:id/bookings", (req, res) => {
    const { id } = req.params;
    const bookings = db.prepare("SELECT * FROM bookings WHERE driver_id = ? AND status != 'completed'").all(id);
    res.json(bookings);
  });

  app.put("/api/bookings/:id", (req, res) => {
    const { id } = req.params;
    const { 
      passenger_name, passenger_phone, flight_number, flight_time, 
      pickup_time, pickup_location, dropoff_location, stops,
      child_seats, meet_greet, notes, passenger_count, luggage_count,
      status, price, driver_id, vehicle_id
    } = req.body;

    db.prepare(`
      UPDATE bookings 
      SET passenger_name = ?, passenger_phone = ?, flight_number = ?, flight_time = ?, 
          pickup_time = ?, pickup_location = ?, dropoff_location = ?, stops = ?,
          child_seats = ?, meet_greet = ?, notes = ?, passenger_count = ?, luggage_count = ?,
          status = ?, price = ?, driver_id = ?, vehicle_id = ?
      WHERE id = ?
    `).run(
      passenger_name, passenger_phone, flight_number, flight_time, 
      pickup_time, pickup_location, dropoff_location, stops,
      child_seats, meet_greet, notes, passenger_count, luggage_count,
      status, price, driver_id, vehicle_id, id
    );
    res.json({ success: true });
  });

  app.patch("/api/bookings/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    // If status is completed, add points to customer
    if (status === 'completed') {
      const booking = db.prepare("SELECT customer_id, price FROM bookings WHERE id = ?").get(id);
      if (booking && booking.customer_id) {
        const pointsToAdd = Math.floor(booking.price * 0.1); // 10% points
        db.prepare("UPDATE customers SET points = points + ? WHERE id = ?").run(pointsToAdd, booking.customer_id);
      }
    }

    db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
  });

  app.delete("/api/bookings/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const stats = {
      today_trips: db.prepare("SELECT COUNT(*) as count FROM bookings WHERE date(pickup_time) = ?").get(today),
      pending_trips: db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'").get(),
      available_drivers: db.prepare("SELECT COUNT(*) as count FROM drivers WHERE status = 'available'").get(),
    };
    res.json(stats);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

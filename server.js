const express = require('express');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'change-this-secret';

// ---------- Hardcoded data (prototype) ----------
const users = [
    { loginId: 'admin', password: 'admin123', role: 'admin', name: 'Admin' },
    { loginId: 'S101', password: '1234', role: 'student', name: 'Student 1', busId: 'bus1' },
    { loginId: 'S102', password: '1234', role: 'student', name: 'Student 2', busId: 'bus2' },
    { loginId: 'D1', password: '1234', role: 'driver', name: 'Driver 1', busId: 'bus1' },
    { loginId: 'D2', password: '1234', role: 'driver', name: 'Driver 2', busId: 'bus2' },
];

const buses = {
    bus1: { id: 'bus1', busNumber: 'Bus 1', routeName: 'Route A', deviceKey: 'key-bus1-9f3a', location: null },
    bus2: { id: 'bus2', busNumber: 'Bus 2', routeName: 'Route B', deviceKey: 'key-bus2-7c1d', location: null },
};

// ---------- App ----------
const app = express();
app.use(express.json(), express.urlencoded({ extended: true }), express.static('public'));
app.get('/', (req, res) => res.redirect('/login.html'));

const auth = (roles = []) => (req, res, next) => {
    try {
        req.user = jwt.verify((req.headers.authorization || '').split(' ')[1], SECRET);
    } catch {
        return res.status(401).json({ msg: 'Login required' });
    }
    if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ msg: 'Forbidden' });
    next();
};

const setLocation = (bus, lat, lng, speed) => {
    if (bus) bus.location = { lat, lng, speed, updatedAt: Date.now() };
    return !!bus;
};

// ---------- Routes ----------
app.post('/api/login', (req, res) => {
    const u = users.find(u => u.loginId === req.body.loginId && u.password === req.body.password);
    if (!u) return res.status(401).json({ msg: 'Invalid ID or password' });
    const token = jwt.sign({ role: u.role, busId: u.busId }, SECRET, { expiresIn: '7d' });
    res.json({ token, role: u.role, name: u.name });
});

// Admin gets all buses; student/driver gets only their own (decided on the server)
app.get('/api/buses', auth(), (req, res) => {
    const list = req.user.role === 'admin' ? Object.values(buses) : [buses[req.user.busId]].filter(Boolean);
    res.json(list.map(({ deviceKey, ...bus }) => bus));
});

// Option A: driver web page (bus comes from the token, never from the request)
app.post('/api/location', auth(['driver']), (req, res) => {
    const { lat, lng, speed } = req.body;
    if (isNaN(lat) || isNaN(lng)) return res.sendStatus(400);
    setLocation(buses[req.user.busId], lat, lng, speed || 0);
    res.sendStatus(200);
});

// Option B (fallback): Traccar Client app, identified by the bus deviceKey
app.all('/api/traccar', (req, res) => {
    const { id, lat, lon, speed } = { ...req.query, ...req.body };
    if (!id || isNaN(lat) || isNaN(lon)) return res.sendStatus(400);
    const bus = Object.values(buses).find(b => b.deviceKey === id);
    res.sendStatus(setLocation(bus, +lat, +lon, (+speed || 0) * 1.852) ? 200 : 403); // knots -> km/h
});

app.listen(process.env.PORT || 5000, () => console.log('Running on http://localhost:5000'));
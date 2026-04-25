require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security middleware to prevent serving sensitive files if we use root as static dir
app.use((req, res, next) => {
    const sensitiveFiles = ['.env', 'package.json', 'package-lock.json', 'server.js', 'database.sqlite'];
    const requestPath = req.path.toLowerCase();
    
    if (sensitiveFiles.some(file => requestPath.includes(file)) || requestPath.includes('/.git')) {
        return res.status(403).send('Forbidden');
    }
    next();
});

// Serve frontend static files from the current folder
app.use(express.static(__dirname));

// Initialize Database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS ContactRequest (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_nombre TEXT,
            dni TEXT,
            edad INTEGER,
            obra_social TEXT,
            domicilio TEXT,
            diagnostico TEXT,
            servicios_medicos BOOLEAN,
            servicios_kinesiologia BOOLEAN,
            servicios_cuidadores BOOLEAN,
            frecuencia TEXT,
            contacto_nombre TEXT,
            vinculo TEXT,
            telefono TEXT,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Nodemailer config
let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// API: Contact Form Submission
app.post('/api/contact', (req, res) => {
    const {
        paciente_nombre, dni, edad, obra_social, domicilio, diagnostico,
        servicios_medicos, servicios_kinesiologia, servicios_cuidadores,
        frecuencia, contacto_nombre, vinculo, telefono, email
    } = req.body;

    const sql = `INSERT INTO ContactRequest (
        paciente_nombre, dni, edad, obra_social, domicilio, diagnostico,
        servicios_medicos, servicios_kinesiologia, servicios_cuidadores,
        frecuencia, contacto_nombre, vinculo, telefono, email
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
        paciente_nombre, dni, edad, obra_social, domicilio, diagnostico,
        servicios_medicos === 'true' || servicios_medicos === true, 
        servicios_kinesiologia === 'true' || servicios_kinesiologia === true, 
        servicios_cuidadores === 'true' || servicios_cuidadores === true,
        frecuencia, contacto_nombre, vinculo, telefono, email
    ];

    db.run(sql, params, function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Optional: Send Email notif
        if (process.env.SMTP_USER && process.env.NOTIFICATION_EMAIL) {
            const mailOptions = {
                from: process.env.SMTP_USER,
                to: process.env.NOTIFICATION_EMAIL,
                subject: `Nueva Solicitud de Atención: ${paciente_nombre}`,
                text: `Se ha recibido una nueva solicitud de servicio en Becsa:

**Paciente:** ${paciente_nombre} (DNI: ${dni}, Edad: ${edad})
**Domicilio:** ${domicilio}
**Obra Social:** ${obra_social || 'Particular'}
**Diagnóstico:** ${diagnostico}

**Contacto Familiar:** ${contacto_nombre} (${vinculo})
**Teléfono:** ${telefono}
**Email:** ${email}
`
            };
            transporter.sendMail(mailOptions).catch(console.error);
        }

        res.status(200).json({ message: 'Solicitud enviada correctamente', id: this.lastID });
    });
});

// Initialize Gemini
let genAI;
if(process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!process.env.GEMINI_API_KEY || !genAI) {
            // Fallback rules if no API key
            const lowerText = (message || '').toLowerCase();
            let responseKey = "¡Entiendo! Para brindarte una respuesta precisa, por favor complétanos tus datos aquí en la web en la sección 'Solicitar Asistencia' y te contactaremos en minutos.";
            
            if(lowerText.includes('medico') || lowerText.includes('consulta')) responseKey = "Nuestras consultas médicas a domicilio brindan evaluación clínica y diagnóstico sin moverte de casa.";
            else if(lowerText.includes('kine') || lowerText.includes('rehabilitacion')) responseKey = "Nuestros kinesiólogos realizan rehabilitación física y respiratoria en tu hogar.";
            else if(lowerText.includes('cuidador') || lowerText.includes('acompañante')) responseKey = "Contamos con cuidadores capacitados para acompañamiento diurno o nocturno.";
            else if(lowerText.includes('obra social') || lowerText.includes('pami')) responseKey = "Trabajamos con PAMI, Medicus, OSPOCE y más. Envíanos tu derivación.";
            
            return res.json({ reply: responseKey });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Eres el asistente virtual de 'Bienestar en Casa' (Becsa), una empresa de salud e internación domiciliaria.
        Responde de forma amable, corta (máximo 2 oraciones) y útil. Ofreces Médicos a domicilio, Kinesiología y Cuidadores.
        Obras sociales: Andar Salud, Apos, Medicals, Medicus, Osmecom, Ospoce, Ospiv, Ospip, Palcare, Pami.
        Pregunta del usuario: ${message}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ reply: response.text() });
    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ error: "Error procesando el chat." });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

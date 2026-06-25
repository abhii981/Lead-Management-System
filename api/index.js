const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('🚀 Starting server...');

// ===== CHECK ENVIRONMENT VARIABLES =====
if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env file!');
    process.exit(1);
}
console.log('✅ Environment variables loaded');

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ===== MONGODB CONNECTION =====
console.log('🔄 Connecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        console.log('📊 Database:', mongoose.connection.name);
    })
    .catch(err => {
        console.error('❌ MongoDB Error:', err.message);
    });

// ===== LEAD SCHEMA =====
const leadSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    companyName: { type: String, default: '' },
    requirement: { type: String, required: true },
    submissionTime: { type: Date, default: Date.now },
    emailOpened: { type: Boolean, default: false },
    emailOpenedAt: { type: Date },
    linkClicked: { type: Boolean, default: false },
    linkClickedAt: { type: Date },
    category: { type: String, default: 'Uncategorized' },
    priority: { type: String, default: 'Medium' }
});

const Lead = mongoose.model('Lead', leadSchema);

// ===== EMAIL SETUP =====
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// ============================================
// ===== API ROUTES =====
// ============================================

// 1. Submit Lead
app.post('/api/leads', async (req, res) => {
    try {
        console.log('📝 Form submitted:', req.body);
        
        const { fullName, email, phone, companyName, requirement } = req.body;

        // AI Classification
        let category = 'Uncategorized';
        let priority = 'Medium';
        
        const lowerReq = requirement.toLowerCase();
        if (lowerReq.includes('chatbot') || lowerReq.includes('ai') || lowerReq.includes('automation')) {
            category = 'AI Automation';
            priority = 'High';
        } else if (lowerReq.includes('website') || lowerReq.includes('web') || lowerReq.includes('ecommerce')) {
            category = 'Web Development';
            priority = 'High';
        } else if (lowerReq.includes('marketing') || lowerReq.includes('social') || lowerReq.includes('seo')) {
            category = 'Digital Marketing';
            priority = 'Medium';
        } else if (lowerReq.includes('data') || lowerReq.includes('analytics') || lowerReq.includes('report')) {
            category = 'Data Analytics';
            priority = 'High';
        } else if (lowerReq.includes('mobile') || lowerReq.includes('app')) {
            category = 'Mobile Development';
            priority = 'Medium';
        }

        // Save to Database
        const lead = new Lead({
            fullName, email, phone, companyName, requirement,
            category, priority
        });
        await lead.save();
        console.log('✅ Lead saved:', lead._id);

        // Send Email with Tracking
        const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
        const trackingPixel = `<img src="${baseUrl}/api/track/open/${lead._id}" width="1" height="1" />`;
        const trackableLink = `${baseUrl}/api/track/click/${lead._id}`;

        const emailHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                <h2 style="color: #2563eb;">Hi ${fullName},</h2>
                <p>Thank you for reaching out to us. We received your requirement:</p>
                <blockquote style="background: #f3f4f6; padding: 15px; border-left: 4px solid #2563eb;">
                    "${requirement}"
                </blockquote>
                
                <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">🧠 AI Analysis Result</h3>
                    <p><strong>Category:</strong> ${category}</p>
                    <p><strong>Priority:</strong> <span style="color: ${priority === 'High' ? '#dc2626' : '#f59e0b'};">${priority}</span></p>
                </div>
                
                <p>
                    <a href="${trackableLink}" style="background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        📖 Learn More About Our Solutions
                    </a>
                </p>
                <p>Our team will get back to you within 24 hours.</p>
                <p>Regards,<br><strong>Team</strong></p>
                ${trackingPixel}
            </div>
        `;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: `📬 Thank you for your interest - ${category} Solutions`,
            html: emailHTML
        });
        console.log('📧 Email sent to:', email);

        res.json({
            success: true,
            leadId: lead._id,
            category,
            priority
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Track Email Open (Pixel)
app.get('/api/track/open/:leadId', async (req, res) => {
    try {
        await Lead.findByIdAndUpdate(req.params.leadId, {
            emailOpened: true,
            emailOpenedAt: new Date()
        });
        console.log('📨 Email opened for lead:', req.params.leadId);
        
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': pixel.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(pixel);
    } catch (error) {
        console.error('❌ Tracking error:', error.message);
        res.status(500).send('Error');
    }
});

// 3. Track Link Click
app.get('/api/track/click/:leadId', async (req, res) => {
    try {
        await Lead.findByIdAndUpdate(req.params.leadId, {
            linkClicked: true,
            linkClickedAt: new Date()
        });
        console.log('🔗 Link clicked for lead:', req.params.leadId);
        res.redirect('https://example.com/thank-you');
    } catch (error) {
        console.error('❌ Click tracking error:', error.message);
        res.redirect('https://example.com');
    }
});

// 4. Dashboard Analytics
app.get('/api/dashboard', async (req, res) => {
    try {
        const totalLeads = await Lead.countDocuments();
        const totalOpened = await Lead.countDocuments({ emailOpened: true });
        const totalClicks = await Lead.countDocuments({ linkClicked: true });
        
        const openRate = totalLeads > 0 ? (totalOpened / totalLeads) * 100 : 0;
        const clickRate = totalLeads > 0 ? (totalClicks / totalLeads) * 100 : 0;

        const categoryData = await Lead.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        const recentLeads = await Lead.find()
            .sort({ submissionTime: -1 })
            .limit(10);

        res.json({
            totalLeads,
            totalEmailsSent: totalLeads,
            totalEmailsOpened: totalOpened,
            openRate: Math.round(openRate * 10) / 10,
            totalLinkClicks: totalClicks,
            clickRate: Math.round(clickRate * 10) / 10,
            categoryData,
            recentLeads
        });
    } catch (error) {
        console.error('❌ Dashboard error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 5. Get all leads
app.get('/api/leads', async (req, res) => {
    try {
        const leads = await Lead.find().sort({ submissionTime: -1 });
        res.json(leads);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`📝 Form: http://localhost:${PORT}`);
});
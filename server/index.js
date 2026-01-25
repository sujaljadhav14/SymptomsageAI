import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars from root .env.local
dotenv.config({ path: join(__dirname, '../.env.local') });

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = process.env.SERVER_PORT || 3001;

// POST /api/send-report
app.post('/api/send-report', async (req, res) => {
    const { email, reportText, userName } = req.body;

    if (!email || !reportText) {
        return res.status(400).json({ error: 'Email and report text are required' });
    }

    try {
        // Create transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '465'),
            secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Setup email data
        const mailOptions = {
            from: `"SymptomSage AI" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `SymptomSage AI - Clinical Report for ${userName || 'User'}`,
            text: reportText,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                    <div style="background: #2563eb; padding: 20px; border-radius: 8px 8px 0 0; color: white;">
                        <h1 style="margin: 0; font-size: 24px;">SymptomSage AI</h1>
                        <p style="margin: 5px 0 0; opacity: 0.8;">Clinical Triage Report</p>
                    </div>
                    <div style="padding: 20px; color: #1e293b; line-height: 1.6;">
                        <p>Hello ${userName || 'there'},</p>
                        <p>Please find your clinical triage report below, as requested from SymptomSage AI.</p>
                        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; font-family: monospace; font-size: 14px;">
${reportText}
                        </div>
                        <p style="margin-top: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                            <strong>Disclaimer:</strong> This report is AI-generated for informational purposes only. It is not a clinical diagnosis. Always consult a qualified healthcare professional for medical advice and treatment.
                        </p>
                    </div>
                    <div style="text-align: center; padding: 20px; font-size: 12px; color: #94a3b8;">
                        &copy; ${new Date().getFullYear()} SymptomSage AI. All rights reserved.
                    </div>
                </div>
            `
        };

        // Send mail
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to: ${email}`);
        res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email. Please check your SMTP configuration.' });
    }
});

app.listen(PORT, () => {
    console.log(`Email server running on http://localhost:${PORT}`);
});

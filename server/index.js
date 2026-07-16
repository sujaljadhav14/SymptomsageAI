import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { GoogleGenAI } from '@google/genai';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars from root .env.local
dotenv.config({ path: join(__dirname, '../.env.local') });

const app = express({ limit: '50mb' }); // Increase limit for base64 images
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// POST /api/chat/summarize
app.post('/api/chat/summarize', async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages are required' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const prompt = `Based on the following medical triage conversation, provide a detailed structured report.
            
            Return a valid JSON object with the following structure:
            {
              "summary": "2-sentence overview of symptoms and severity",
              "precautions": ["list", "of", "immediate", "medical", "precautions"],
              "severity": "low" | "medium" | "high" | "emergency",
              "recommendedTests": ["list", "of", "general", "medical", "tests", "that", "might", "be", "needed"],
              "differentiation": "What makes this case different or unique based on the patient's description"
            }
      
            Conversation:
            ${messages.map(m => `${m.role}: ${m.text}`).join('\n')}
      
            Return ONLY the raw JSON.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ report: text });
    } catch (error) {
        console.error('Summarization error:', error);
        res.status(500).json({ error: 'Failed to generate summary' });
    }
});

// POST /api/analyze-image
app.post('/api/analyze-image', async (req, res) => {
    const { image, prompt } = req.body;

    if (!image) {
        return res.status(400).json({ error: 'Image is required' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const base64Data = image.includes('base64,') ? image.split('base64,')[1] : image;

        const defaultPrompt = `You are a medical AI assistant. Analyze this medical image and provide:
1. A brief description of what you observe
2. Potential medical concerns or symptoms visible
3. Recommended immediate actions or precautions
4. Whether the person should seek immediate medical attention

IMPORTANT: Always include a disclaimer that this is not a professional medical diagnosis and the user should consult a healthcare provider for accurate diagnosis and treatment.

Be professional, empathetic, and clear in your response.`;

        const result = await model.generateContent([
            { text: prompt || defaultPrompt },
            {
                inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data
                }
            }
        ]);

        const response = await result.response;
        res.json({ text: response.text() });
    } catch (error) {
        console.error('Image analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze image' });
    }
});

const PORT = process.env.PORT || process.env.SERVER_PORT || 3001;

// Validate required environment variables
const requiredEnvVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.warn(`Warning: Missing SMTP environment variables: ${missingEnvVars.join(', ')}`);
    console.warn('Email functionality may not work correctly.');
}

// POST /api/send-report
app.post('/api/send-report', async (req, res) => {
    const { email, reportText, userName } = req.body;

    // Basic validation
    if (!email || !reportText) {
        return res.status(400).json({ error: 'Email and report text are required' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    // Sanitize user-provided fields
    const sanitizedUserName = DOMPurify.sanitize(userName || 'User');
    const sanitizedReportText = DOMPurify.sanitize(reportText);

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
            subject: `SymptomSage AI - Clinical Report for ${sanitizedUserName}`,
            text: reportText, // Plain text version (we can use raw reportText here as it's not rendered as HTML)
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <div style="background: #2563eb; padding: 20px; border-radius: 8px 8px 0 0; color: white;">
                        <h1 style="margin: 0; font-size: 24px;">SymptomSage AI</h1>
                        <p style="margin: 5px 0 0; opacity: 0.8;">Clinical Triage Report</p>
                    </div>
                    <div style="padding: 20px; color: #1e293b; line-height: 1.6;">
                        <p>Hello ${sanitizedUserName},</p>
                        <p>Please find your clinical triage report below, as requested from SymptomSage AI.</p>
                        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; font-family: monospace; font-size: 14px;">
${sanitizedReportText}
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

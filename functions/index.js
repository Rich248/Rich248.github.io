const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Create Nodemailer transporter using environment variables
// Set these with: firebase functions:secrets:set EMAIL_USER
// And: firebase functions:secrets:set EMAIL_PASS
const createTransporter = () => {
    // Get credentials from environment variables
    const emailUser = process.env.EMAIL_USER || functions.config().email?.user || 'your-email@gmail.com';
    const emailPass = process.env.EMAIL_PASS || functions.config().email?.pass || 'your-app-password';
    const smtpHost = process.env.SMTP_HOST || functions.config().smtp?.host || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || functions.config().smtp?.port || '587');

    return nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
};

// HTTP Cloud Function to send OTP emails - Can be called from frontend
exports.sendOTP = functions.https.onCall(async (data, context) => {
    const { to_email, to_name, otp_code } = data;
    
    if (!to_email || !otp_code) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: to_email, otp_code');
    }

    const transporter = createTransporter();

    const fromEmail = process.env.EMAIL_USER || functions.config().email?.user || 'noreply@ghanatrustbank.com';
    
    const mailOptions = {
        from: `"GhanaTrust Bank" <${fromEmail}>`,
        to: to_email,
        subject: 'Your GhanaTrust Bank Login OTP',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
                <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 1.75rem;">GhanaTrust Bank</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Secure Banking for Ghanaians</p>
                </div>
                <div style="padding: 40px 30px; background: white;">
                    <h2 style="color: #1e293b; margin: 0 0 20px 0;">Login Verification</h2>
                    <p style="color: #64748b; line-height: 1.6; font-size: 1rem;">
                        Hello ${to_name || 'Valued Customer'},
                    </p>
                    <p style="color: #64748b; line-height: 1.6; font-size: 1rem;">
                        Your One-Time Password (OTP) for GhanaTrust Bank login is:
                    </p>
                    <div style="background: #f0f9ff; border: 2px dashed #0ea5e9; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                        <p style="font-size: 2.5rem; font-weight: bold; color: #1e40af; margin: 0; letter-spacing: 8px;">${otp_code}</p>
                    </div>
                    <p style="color: #64748b; line-height: 1.6; font-size: 0.95rem;">
                        This code will expire in <strong>10 minutes</strong>. Do not share this code with anyone.
                    </p>
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                        <p style="color: #92400e; margin: 0; font-size: 0.9rem;">
                            <strong>Security Tip:</strong> GhanaTrust Bank will never ask for your OTP via phone, SMS, or email. If someone asks for your OTP, it's a scam.
                        </p>
                    </div>
                    <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 30px;">
                        If you didn't request this OTP, please contact us immediately at 030 221 2222 or email support@ghanatrustbank.com
                    </p>
                </div>
                <div style="background: #1e293b; padding: 20px; text-align: center;">
                    <p style="color: #94a3b8; margin: 0; font-size: 0.85rem;">
                        © ${new Date().getFullYear()} GhanaTrust Bank. All rights reserved.<br>
                        Bank of Ghana regulated. Member of Ghana Association of Banks.
                    </p>
                </div>
            </div>
        `,
        text: `GhanaTrust Bank Login OTP\n\nHello ${to_name || 'Valued Customer'},\n\nYour OTP is: ${otp_code}\n\nThis code expires in 10 minutes. Do not share this code with anyone.\n\nIf you didn't request this, contact us at 030 221 2222.`
    };

    try {
        const result = await transporter.sendMail(mailOptions);
        console.log('OTP email sent successfully to:', to_email, 'Message ID:', result.messageId);
        return { 
            success: true, 
            messageId: result.messageId,
            message: 'OTP sent successfully'
        };
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send email: ' + error.message);
    }
});

// HTTP Cloud Function to send generic emails
exports.sendEmail = functions.https.onCall(async (data, context) => {
    const { to_email, subject, html_content, text_content } = data;
    
    if (!to_email || !subject) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: to_email, subject');
    }

    const transporter = createTransporter();

    const fromEmail = process.env.EMAIL_USER || functions.config().email?.user || 'noreply@ghanatrustbank.com';
    
    const mailOptions = {
        from: `"GhanaTrust Bank" <${fromEmail}>`,
        to: to_email,
        subject: subject,
        html: html_content || '',
        text: text_content || ''
    };

    try {
        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully to:', to_email);
        return { 
            success: true, 
            messageId: result.messageId 
        };
    } catch (error) {
        console.error('Error sending email:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send email: ' + error.message);
    }
});

// Triggered function - Send welcome email when new user is added
exports.sendWelcomeEmail = functions.database.ref('/users/{userId}')
    .onCreate(async (snapshot, context) => {
        const userData = snapshot.val();
        
        if (!userData.email) {
            console.log('No email found for user:', context.params.userId);
            return null;
        }

        const transporter = createTransporter();

        const fromEmail = process.env.EMAIL_USER || functions.config().email?.user || 'noreply@ghanatrustbank.com';

        const mailOptions = {
            from: `"GhanaTrust Bank" <${fromEmail}>`,
            to: userData.email,
            subject: 'Welcome to GhanaTrust Bank - Application Received',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #1e40af; padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0;">GhanaTrust Bank</h1>
                    </div>
                    <div style="padding: 30px; background: #f8fafc;">
                        <h2 style="color: #1e293b;">Welcome, ${userData.firstName || 'Valued Customer'}!</h2>
                        <p style="color: #64748b; line-height: 1.6;">
                            Thank you for choosing GhanaTrust Bank. We have received your ${userData.accountType || 'account'} application.
                        </p>
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af;">
                            <p style="margin: 0; color: #64748b; font-size: 0.9rem;">REFERENCE NUMBER</p>
                            <p style="margin: 5px 0 0 0; font-size: 1.5rem; font-weight: bold; color: #1e40af;">GTB-${Math.floor(100000 + Math.random() * 900000)}</p>
                        </div>
                        <p style="color: #64748b; line-height: 1.6;">
                            Our verification team will review your application within 24 hours. You will receive another email once your account is approved.
                        </p>
                        <p style="color: #64748b; line-height: 1.6;">
                            <strong>Application Details:</strong><br>
                            Account Type: ${userData.accountType || 'N/A'}<br>
                            Branch: ${userData.branch || 'N/A'}<br>
                            Application Date: ${userData.applicationDate ? new Date(userData.applicationDate).toLocaleDateString() : new Date().toLocaleDateString()}
                        </p>
                        <p style="color: #64748b; line-height: 1.6; margin-top: 20px;">
                            If you have any questions, please contact our customer service at 030 221 2222.
                        </p>
                    </div>
                    <div style="background: #1e293b; padding: 20px; text-align: center;">
                        <p style="color: #94a3b8; margin: 0; font-size: 0.85rem;">
                            © ${new Date().getFullYear()} GhanaTrust Bank. All rights reserved.<br>
                            Bank of Ghana regulated. Member of Ghana Association of Banks.
                        </p>
                    </div>
                </div>
            `
        };

        try {
            const result = await transporter.sendMail(mailOptions);
            console.log('Welcome email sent to:', userData.email, 'Message ID:', result.messageId);
            return null;
        } catch (error) {
            console.error('Error sending welcome email:', error);
            return null;
        }
    });

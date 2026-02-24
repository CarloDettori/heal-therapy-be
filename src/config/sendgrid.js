import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
console.log('SENDGRID KEY starts with SG:', (process.env.SENDGRID_API_KEY || '').startsWith('SG.'));
export default sgMail;
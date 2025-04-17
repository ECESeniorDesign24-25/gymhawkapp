import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,                       // SSL
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export async function sendMachineAvailableEmail(
  to: string,
  machineName: string
) {
  await transporter.sendMail({
    from: `"GymHawks" <${process.env.SMTP_USER}>`,
    to,
    subject: `${machineName} is now available!`,
    text: `The ${machineName} you've been waiting for is free.`,
    html: `<p>The <strong>${machineName}</strong> you’ve been waiting for is now
           <span style="color:green">available</span>. See you there 🏋️‍♂️, we cannot guarantee the machine will be open upon arrival.</p>`,
  });
}

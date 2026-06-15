import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

/**
 * Order confirmation email. Invoked by the API after an order is placed.
 * Expected event payload: { to, orderId, total }.
 */
const ses = new SESClient({});

export const handler = async (event) => {
  const { to, orderId, total } = event;
  if (!to || !orderId) {
    return { statusCode: 400, body: "Missing to/orderId" };
  }

  await ses.send(
    new SendEmailCommand({
      Source: process.env.FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: `Your SoleMate order #${orderId}` },
        Body: {
          Html: {
            Data: `<h1>Thanks for your order!</h1>
                   <p>Order <strong>#${orderId}</strong> is confirmed.</p>
                   <p>Total: <strong>$${total}</strong></p>`,
          },
        },
      },
    })
  );

  return { statusCode: 200, body: "sent" };
};

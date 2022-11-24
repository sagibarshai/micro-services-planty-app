import { Router } from "express";
import {
     unauthorized,
     currentuser,
     validateRequest,
     DatabaseError,
} from "@planty-errors-handler/common";
import { body } from "express-validator";
import { makeOrdersDocument } from "../middlewares/make-orders-document";
import { PaymentsRequest, PaymentsResponse } from "./types/types";
import { stripe } from "../stripe/stripe";
import { PaymentCreatedEvent } from "@planty-errors-handler/common";
import { natsWrapper } from "@planty-errors-handler/common";
import Stripe from "stripe";
import { PaymentCreatedPublisher } from "../events/publishers/payment-created-publisher";
const router = Router();
router.post(
     "/api/payments/charge",
     unauthorized,
     currentuser,
     [
          body("cardNumber")
               .isLength({ min: 8, max: 8 })
               .withMessage("Card number must be 8 characters"),
          body("cardCvv")
               .isLength({ min: 3, max: 3 })
               .withMessage("Card CVV must be 3 characters"),
          body("cardExprationDate")
               .not()
               .isEmpty()
               .withMessage("Card Expretion Date must be valid"),
          body("cardExprationDate")
               .not()
               .isEmpty()
               .withMessage("Card Expretion Date must be valid"),
          body("sum")
               .not()
               .isEmpty()
               .isInt({ gt: 0 })
               .withMessage("Sum must be valid"),
     ],
     validateRequest,
     makeOrdersDocument,
     async (req: PaymentsRequest, res: PaymentsResponse) => {
          const userOrdersDocument = res.locals.orders;
          const bodyData = req.body;
          let token;
          try {
               const params = {
                    card: {
                         number: "4242424242424242",
                         exp_month: "12",
                         exp_year: "2023",
                         cvc: "123",
                    },
               };
               token = await stripe.tokens.create(params);
               await stripe.charges.create({
                    amount: 100,
                    receipt_email: res.locals.userPayload.email,
                    currency: "usd",
                    source: token.id,
                    description: "test",
               });
          } catch (err) {
               console.log(err);
               throw new Error("Payment error! " + err);
          }

          try {
               const currentDate = new Date().toString();
               const userOrdersTransactions = userOrdersDocument.transactions;
               userOrdersTransactions.push({
                    date: currentDate,
                    sum: bodyData.sum,
               });
               userOrdersDocument.save();
               await new PaymentCreatedPublisher(natsWrapper.client).publish({
                    email: res.locals.userPayload.email,
                    name:
                         res.locals.userPayload.firstName +
                         res.locals.userPayload.lastName,
                    userId: res.locals.userPayload.id,
                    sum: bodyData.sum,
               });
               res.status(200).send({ userOrdersDocument });
          } catch (err) {
               console.log(err);
               throw new DatabaseError("Database error");
          }
     }
);
export { router as ChargeRoute };

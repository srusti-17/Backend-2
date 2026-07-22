import { Router } from "express";
import {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
} from "../controller/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/c/:channelId")
    .get(getUserChannelSubscribers)
    .post(verifyJWT, toggleSubscription);

router.route("/u/:subscriberId").get(getSubscribedChannels);

export default router;

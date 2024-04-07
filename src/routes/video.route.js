import { Router } from "express";
import { getAllVideos, publishAVideo, togglePublishStatus } from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";


const router = Router()


router.route("/")
        .get(getAllVideos)
        .post(verifyJWT, upload.fields([
                {
                    name: "videoFile",
                    maxCount: 1
                },
                {
                    name: "thumbnail",
                    maxCount: 1
                }
            ]),
            publishAVideo
        )

router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);

export default router
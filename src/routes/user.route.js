import { Router } from "express";
import { loginUser, logoutUser, registerUser } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router()

//register
router.route("/register").post(
    // multer middleware set
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),

    registerUser
)

//login
router.route('/login').post(loginUser)




//------------secure routes-------------
// logout
router.route('/logout').post(verifyJWT, logoutUser)


export default router
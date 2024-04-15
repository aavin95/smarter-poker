export { default } from "next-auth/middleware"

// add routes that you want to be blocked unless signed in to the array bellow
export const config = { matcher: ["/dashboard", "/play"] }
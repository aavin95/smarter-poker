import { options } from "../api/auth/[...nextauth]/route"
import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"

export default async function ServerPage() { 
    const session = await getServerSession(options)
    if (!session) {
        redirect("/api/auth/signin?callbackUrl=/dashboard")
    }
    return (
        <section className="text-gray-600 body-font">
            <div className="container px-5 py-24 mx-auto">
                <div className="flex flex-wrap w-full mb-20 flex-col items-center text-center">
                    <h1 className="sm:text-3xl text-2xl font-medium title-font mb-2 text-gray-900">Dashboard Page</h1>
                    <p className="lg:w-1/2 w-full leading-relaxed text-base">This page is protected by the server middleware, but you can see it.</p>
                </div>
            </div>
        </section>
    )
}
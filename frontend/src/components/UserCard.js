import Image from 'next/image'

type User = {
    name?: string | null | undefined;
    email?: string | null | undefined;
    image?: string | null | undefined;
} | undefined

type Props = {
    user: User;
    pagetype: string;
}

export default function Card({ user, pagetype }) {
    const greeting = user?.name ? (
        <div className='text-4xl font-bold'>
            Hello {user?.name}!
        </div>
    ) : null

    const userImage = user?.image ? (
        <Image src={user?.image} alt='User Image' width={100} height={100} />
    ) : null

    return (
        <div className='bg-white p-4 shadow-md rounded-md'>
            {greeting}
            <div className='text-gray-500'>
                {user?.email}
            </div>
            {userImage}
            <div className='text-gray-500'>
                {pagetype}
            </div>
        </div>
    )
}


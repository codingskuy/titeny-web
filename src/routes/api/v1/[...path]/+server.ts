import { env } from '$env/dynamic/private';
import { teruskan } from '$lib/server/proxy';
import type { RequestHandler } from './$types';

const upstream = () => env.TITENY_API_URL ?? 'http://localhost:8080';

export const GET: RequestHandler = ({ request, params }) => teruskan(request, params.path, upstream());
export const POST: RequestHandler = ({ request, params }) => teruskan(request, params.path, upstream());

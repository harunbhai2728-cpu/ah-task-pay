import toast from 'react-hot-toast';

interface FetchWithRetryOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
}

export async function fetchWithRetry(url: string, options: FetchWithRetryOptions = {}): Promise<Response> {
  let { retries = 3, retryDelay = 2000, ...fetchOptions } = options;
  let attempt = 0;

  while (attempt < retries) {
    try {
      const response = await fetch(url, fetchOptions);
      
      // If response is successful, or it's a client error (4xx) other than 429, don't retry.
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }
      
      throw new Error(`Server returned ${response.status}`);
    } catch (error: any) {
      attempt++;
      
      const isFailedToFetch = error.message.includes('Failed to fetch') || error.message.includes('NetworkError');

      if (attempt >= retries) {
        if (isFailedToFetch) {
          toast.error("Network connection error. Server might be waking up.");
        }
        throw error;
      }

      if (isFailedToFetch) {
        console.warn(`Attempt ${attempt} failed. Retrying in ${retryDelay}ms... (Server might be sleeping)`);
        toast.loading("Connection weak, retrying...", { id: 'retry-toast', duration: retryDelay });
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error("Maximum retries reached");
}

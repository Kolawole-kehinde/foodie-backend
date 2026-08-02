import dotenv from 'dotenv'

dotenv.config()

function checkRequiredEnvVariables(key: string) {
   const value = process.env[key]

   if(!value){
   throw new Error(`Missing required environment variable: ${key}`)
   }

   return value
}

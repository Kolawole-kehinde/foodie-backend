import type { NotificationChannel, NotificationType } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createNotificationPreferenceRepository = (db: DatabaseClient) => {
  const findPreference = async (
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
  ) => {
     return db.notificationPreference.findUnique({
         where: {
           userId_type_channel:{
              userId,
              type,
              channel
           }
         }
     })
  };



  return{
    findPreference,
  }
};


export type PreferenceRepository = ReturnType<typeof createNotificationPreferenceRepository>
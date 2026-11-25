package com.quemarket.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static final String PUSH_CHANNEL_ID = "quemarket_mensajes";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createQuemarketNotificationChannel();
    }

    private void createQuemarketNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) {
                return;
            }
            NotificationChannel channel = new NotificationChannel(
                PUSH_CHANNEL_ID,
                "Mensajes y alertas",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(
                "Notificaciones instantáneas de nuevos mensajes, ofertas y ventas en Quemarket"
            );
            channel.enableLights(true);
            channel.setLightColor(Color.parseColor("#362B3D"));
            channel.enableVibration(true);
            manager.createNotificationChannel(channel);
        }
    }
}

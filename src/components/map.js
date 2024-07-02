'use client'

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css";
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io(process.env.NEXT_PUBLIC_SERVER_URL);

export default function Map() {
    const user_id = 'user_id';

    const [markers, setMarkers] = useState({
        [user_id]: { 
            latitude: 54.697325, 
            longitude: 25.315356,
            live_period: null,
            quest: '',
            username: ''
        }
    });

    useEffect(() => {
        socket.on("receive_location", (data) => {
            const {
                latitude,
                longitude,
                live_period,
                user_id,
                quest,
                username
            } = data;
            setMarkers(prevMarkers => ({ 
                ...prevMarkers,
                [user_id]: { latitude, longitude, live_period, quest, username }
            }));
        });
    }, [socket]); //Run every socket mount

    return (
        <MapContainer
            center={[markers[user_id].latitude, markers[user_id].longitude]}
            zoom={4}
            style={{ height: "100vh", width: "100%" }}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
        {Object.entries(markers).map(([user_id, { latitude, longitude, live_period, quest, username }]) => 
            live_period && (
                <Marker key={user_id} position={[latitude, longitude]}>
                    <Popup>
                        @{username}: {quest}
                    </Popup>
                </Marker>
            )
        )}
        </MapContainer>
    );
}

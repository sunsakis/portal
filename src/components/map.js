'use client'

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css";
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io(process.env.NEXT_PUBLIC_SERVER_URL);

export default function Map() {
    const [location, setLocation] = useState({ 
        latitude: 54.697325, 
        longitude: 25.315356,
        live_period: null
    });

    useEffect(() => {
        socket.on("receive_location", (location) => {
            setLocation({ 
                latitude: location.latitude, 
                longitude: location.longitude,
                live_period: location.live_period
            });
        });
    }, [socket]); //Empty array to run once on mount

    return (
        <MapContainer
            center={[location.latitude, location.longitude]}
            zoom={4}
            style={{ height: "100vh", width: "100%" }}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {location.live_period && (
                <Marker position={[location.latitude, location.longitude]}>
                    <Popup>
                        A pretty CSS3 popup. <br /> Easily customizable.
                    </Popup>
                </Marker>
            )}
        </MapContainer>
    );
}

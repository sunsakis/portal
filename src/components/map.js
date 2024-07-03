'use client'

import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css";
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";

const socket = io(process.env.NEXT_PUBLIC_SERVER_URL);

const MaptilerVectorLayer = ({ apiKey }) => {
    const map = useMap();
  
    useEffect(() => {
      // Create and add the Maptiler layer to the map
      const mtLayer = new MaptilerLayer({
        apiKey: apiKey, // Use the apiKey prop passed to the component
      });
      mtLayer.addTo(map);
  
      // Cleanup function to remove the layer when the component unmounts
      return () => {
        if (map.hasLayer(mtLayer)) {
          map.removeLayer(mtLayer);
        }
      };
    }, [map, apiKey]); // Dependencies array ensures this runs only when map instance or apiKey changes
  
    return null; // This component does not render anything itself
  };

export default function Map() {
    const user_id = 'user_id';

    const [markers, setMarkers] = useState({
        [user_id]: { 
            latitude: 54.697325, 
            longitude: 25.315356,
            live_period: null,
            quest: '',
            name: ''
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
                name
            } = data;
            setMarkers(prevMarkers => ({ 
                ...prevMarkers,
                [user_id]: { latitude, longitude, live_period, quest, name }
            }));
        });
    }, [socket]); //Run every socket mount

    return (
        <MapContainer
            center={[markers[user_id].latitude, markers[user_id].longitude]}
            zoom={12}
            style={{ height: "100vh", width: "100%" }}
        >
        <MaptilerVectorLayer apiKey={ process.env.NEXT_PUBLIC_MAPTILER_API } />
            {Object.entries(markers).map(([user_id, { latitude, longitude, live_period, quest, name }]) => 
                live_period && (
                    <Marker key={user_id} position={[latitude, longitude]}>
                        <Popup>
                            {name}: {quest}
                        </Popup>
                    </Marker>
                )
            )}
        </MapContainer>
    );
}

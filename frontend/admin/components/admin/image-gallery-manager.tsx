// components/admin/image-gallery-manager.tsx
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Upload } from "lucide-react";

interface ImageGalleryManagerProps {
  mainImage: string;
  galleryImages: string[];
  onMainImageChange: (url: string) => void;
  onGalleryImagesChange: (urls: string[]) => void;
}

export function ImageGalleryManager({
  mainImage,
  galleryImages = [],
  onMainImageChange,
  onGalleryImagesChange,
}: ImageGalleryManagerProps) {
  const [newImageUrl, setNewImageUrl] = useState("");
  
  const addGalleryImage = () => {
    if (!newImageUrl.trim()) return;
    
    // Validar URL de imagen
    if (!/^(https?:\/\/|\/)/.test(newImageUrl)) {
      alert("Por favor ingrese una URL válida");
      return;
    }
    
    // Sanitizar URL
    const safeUrl = newImageUrl.trim();
    
    // Añadir a la galería
    onGalleryImagesChange([...galleryImages, safeUrl]);
    setNewImageUrl("");
  };
  
  const removeGalleryImage = (index: number) => {
    const updatedGallery = [...galleryImages];
    updatedGallery.splice(index, 1);
    onGalleryImagesChange(updatedGallery);
  };
  
  return (
    <div className="space-y-6">
      {/* Imagen principal */}
      <div>
        <h3 className="text-lg font-medium mb-2">Imagen Principal</h3>
        {mainImage && (
          <div className="relative w-40 h-40 mb-2">
            <Image
              src={mainImage}
              alt="Imagen principal"
              fill
              className="object-cover rounded border"
            />
          </div>
        )}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="URL de imagen principal"
            value={mainImage}
            onChange={(e) => onMainImageChange(e.target.value)}
            className="max-w-md"
          />
        </div>
      </div>
      
      {/* Galería de imágenes */}
      <div>
        <h3 className="text-lg font-medium mb-2">Imágenes Adicionales (Galería)</h3>
        
        <div className="flex flex-wrap gap-4 mb-4">
          {galleryImages.map((img, index) => (
            <div key={index} className="relative w-32 h-32 group">
              <Image
                src={img}
                alt={`Galería ${index + 1}`}
                fill
                className="object-cover rounded border"
              />
              <button
                type="button"
                onClick={() => removeGalleryImage(index)}
                className="absolute top-1 right-1 bg-red-500 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="URL de nueva imagen"
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            className="max-w-md"
          />
          <Button type="button" onClick={addGalleryImage} variant="outline">
            <Plus size={16} className="mr-2" /> Añadir
          </Button>
        </div>
      </div>
    </div>
  );
}
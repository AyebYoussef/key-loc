/*
 ===============================================================================
  KeyLocator — Firmware ESP8266 / NodeMCU (Guidage Lumineux IoT)
 ===============================================================================
  Matériel :
    - Carte ESP8266 (NodeMCU v2/v3 ou Wemos D1 Mini)
    - Breadboard + 3 LEDs + résistances (220Ω ou 330Ω)
  
  Câblage des LEDs :
    - LED Casier A1 (Clé UE 11R) : Broche D3 (GPIO 0) -> Anode (+) | GND -> Cathode (-)
    - LED Casier A2 (Clé C8 208) : Broche D4 (GPIO 2) -> Anode (+) | GND -> Cathode (-)
    - LED Casier A3 (Clé UG 5D)  : Broche D5 (GPIO 14)-> Anode (+) | GND -> Cathode (-)

  Fonctionnement :
    1. L'ESP8266 se connecte à votre réseau Wi-Fi local.
    2. Il interroge en continu le Backend FastAPI (http://<PC_IP>:8000/api/iot/active).
    3. Dès qu'une clé est identifiée par le scan Web, la LED du casier correspondant
       clignote pendant 10 secondes !
    4. Un mini-serveur Web interne permet aussi de tester les LEDs depuis un navigateur :
       http://<IP_ESP8266>/test
 ===============================================================================
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WebServer.h>
#include <WiFiClient.h>

// =============================================================================
// 1. CONFIGURATION DU RÉSEAU WI-FI & DU SERVEUR BACKEND
// =============================================================================
const char* WIFI_SSID     = "VOTRE_NOM_WIFI";       // <-- Remplacez par le nom de votre box Wi-Fi
const char* WIFI_PASSWORD = "VOTRE_MOT_DE_PASSE";   // <-- Mot de passe Wi-Fi

// Adresse IP de votre PC sur le réseau local (affichée au démarrage du projet)
const char* SERVER_HOST   = "192.168.1.17";         // <-- IP locale de votre ordinateur
const int   SERVER_PORT   = 8000;

// URL de l'endpoint ultra-léger du backend
const String IOT_ENDPOINT = "/api/iot/active";

// =============================================================================
// 2. CONFIGURATION DES BROCHES (PINS) DES 3 CASIERS
// =============================================================================
const int PIN_A1 = D3;  // Casier A1 (UE 11R)
const int PIN_A2 = D4;  // Casier A2 (C8 208 / C8 206)
const int PIN_A3 = D5;  // Casier A3 (UG 5D)

// Durée de clignotement par défaut (10 secondes)
const unsigned long DUREE_CLIGNOTEMENT_MS = 10000;
const unsigned long PERIODE_BLINK_MS      = 200;    // Clignote toutes les 200ms

// =============================================================================
// VARIABLES GLOBALES
// =============================================================================
ESP8266WebServer server(80);
WiFiClient wifiClient;

int pinActif = -1;                          // -1 = aucune LED active
unsigned long finClignotement = 0;          // Timestamp d'extinction
unsigned long dernierBlink = 0;
bool etatLedBlink = false;
unsigned long dernierPoll = 0;
const unsigned long INTERVALLE_POLL_MS = 350; // Interroge le serveur toutes les 350ms


// =============================================================================
// FONCTIONS DE CONTRÔLE DES LEDS
// =============================================================================
void eteindreToutesLesLeds() {
  digitalWrite(PIN_A1, LOW);
  digitalWrite(PIN_A2, LOW);
  digitalWrite(PIN_A3, LOW);
  pinActif = -1;
  finClignotement = 0;
}

void activerCasier(String casier, unsigned long dureeMs = DUREE_CLIGNOTEMENT_MS) {
  eteindreToutesLesLeds();

  if (casier == "A1") {
    pinActif = PIN_A1;
    Serial.println(">>> [IOT] Casier A1 localisé ! Clignotement LED D3 (10s)");
  } else if (casier == "A2") {
    pinActif = PIN_A2;
    Serial.println(">>> [IOT] Casier A2 localisé ! Clignotement LED D4 (10s)");
  } else if (casier == "A3") {
    pinActif = PIN_A3;
    Serial.println(">>> [IOT] Casier A3 localisé ! Clignotement LED D5 (10s)");
  } else {
    return;
  }

  finClignotement = millis() + dureeMs;
}

void gererClignotement() {
  if (pinActif == -1) return;

  unsigned long maintenant = millis();

  // Fin du délai de 10 secondes atteint -> éteindre
  if (maintenant >= finClignotement) {
    Serial.println(">>> [IOT] Fin des 10s — Extinction de la LED");
    eteindreToutesLesLeds();
    return;
  }

  // Animation de clignotement régulier (200ms ON / 200ms OFF)
  if (maintenant - dernierBlink >= PERIODE_BLINK_MS) {
    dernierBlink = maintenant;
    etatLedBlink = !etatLedBlink;
    digitalWrite(pinActif, etatLedBlink ? HIGH : LOW);
  }
}

// =============================================================================
// INTERROGATION DU BACKEND FASTAPI (POLLING)
// =============================================================================
void interrogerServeur() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + IOT_ENDPOINT;

  http.begin(wifiClient, url);
  http.setTimeout(800);

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String reponse = http.getString();
    reponse.trim();

    if (reponse == "A1" || reponse == "A2" || reponse == "A3") {
      // Si la LED n'est pas déjà en train de clignoter pour ce casier
      int cible = (reponse == "A1") ? PIN_A1 : ((reponse == "A2") ? PIN_A2 : PIN_A3);
      if (pinActif != cible || millis() >= finClignotement) {
        activerCasier(reponse);
      }
    }
  }

  http.end();
}

// =============================================================================
// SERVEUR WEB LOCAL ESP8266 (Test direct & Webhooks)
// =============================================================================
void setupWebServer() {
  server.on("/", []() {
    String html = "<h1>KeyLocator ESP8266 pret !</h1>"
                  "<p>IP : " + WiFi.localIP().toString() + "</p>"
                  "<ul>"
                  "<li><a href='/blink?casier=A1'>Tester Casier A1 (D3)</a></li>"
                  "<li><a href='/blink?casier=A2'>Tester Casier A2 (D4)</a></li>"
                  "<li><a href='/blink?casier=A3'>Tester Casier A3 (D5)</a></li>"
                  "<li><a href='/test'>Tester toutes les LEDs</a></li>"
                  "<li><a href='/off'>Tout eteindre</a></li>"
                  "</ul>";
    server.send(200, "text/html", html);
  });

  server.on("/blink", []() {
    if (server.hasArg("casier")) {
      String casier = server.arg("casier");
      activerCasier(casier);
      server.send(200, "text/plain", "OK: Casier " + casier + " clignote 10s");
    } else {
      server.send(400, "text/plain", "Parametre 'casier' manquant");
    }
  });

  server.on("/test", []() {
    Serial.println(">>> [TEST] Cycle de test des 3 LEDs...");
    for (int i = 0; i < 3; i++) {
      digitalWrite(PIN_A1, HIGH); delay(150); digitalWrite(PIN_A1, LOW);
      digitalWrite(PIN_A2, HIGH); delay(150); digitalWrite(PIN_A2, LOW);
      digitalWrite(PIN_A3, HIGH); delay(150); digitalWrite(PIN_A3, LOW);
    }
    server.send(200, "text/plain", "Test effectue avec succes sur D3, D4, D5 !");
  });

  server.on("/off", []() {
    eteindreToutesLesLeds();
    server.send(200, "text/plain", "Toutes les LEDs sont eteintes");
  });

  server.begin();
  Serial.println("[HTTP] Serveur Web ESP8266 demarre sur le port 80");
}

// =============================================================================
// INITIALISATION (SETUP)
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("==================================================");
  Serial.println("       KeyLocator — Demarrage ESP8266 IoT         ");
  Serial.println("==================================================");

  // Configuration des broches en SORTIE
  pinMode(PIN_A1, OUTPUT);
  pinMode(PIN_A2, OUTPUT);
  pinMode(PIN_A3, OUTPUT);
  eteindreToutesLesLeds();

  // Animation de démarrage (LED test rapide)
  digitalWrite(PIN_A1, HIGH); delay(100); digitalWrite(PIN_A1, LOW);
  digitalWrite(PIN_A2, HIGH); delay(100); digitalWrite(PIN_A2, LOW);
  digitalWrite(PIN_A3, HIGH); delay(100); digitalWrite(PIN_A3, LOW);

  // Connexion Wi-Fi
  Serial.print("Connexion au Wi-Fi : ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tentatives = 0;
  while (WiFi.status() != WL_CONNECTED && tentatives < 30) {
    delay(500);
    Serial.print(".");
    tentatives++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println(">>> Wi-Fi CONNECTE avec succes !");
    Serial.print(">>> Adresse IP de l'ESP8266 : ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("⚠️ Echec de connexion Wi-Fi. Verifiez SSID et mot de passe.");
  }

  // Démarrer le serveur Web local
  setupWebServer();
  Serial.println("==================================================");
  Serial.println("ESP8266 pret a recevoir les commandes de scan !");
  Serial.println("==================================================");
}

// =============================================================================
// BOUCLE PRINCIPALE (LOOP)
// =============================================================================
void loop() {
  server.handleClient();
  gererClignotement();

  // Interrogation périodique du Backend (toutes les 350ms)
  unsigned long maintenant = millis();
  if (maintenant - dernierPoll >= INTERVALLE_POLL_MS) {
    dernierPoll = maintenant;
    interrogerServeur();
  }
}

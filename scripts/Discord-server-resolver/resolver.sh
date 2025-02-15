#!/bin/bash
# verifie si tu es root
if [ "$EUID" -ne 0 ]; then
    clear
    echo "Erreur : ce script doit être exécuté en tant que root."
    exit 1
fi

# verifie si tcpdump est installé
if ! command -v tcpdump &> /dev/null; then
    echo "tcpdump n'est pas installé. Installation en cours..."
    apt update && apt install -y tcpdump
fi

# trouve l'interface internet:
interface=$(ip route | grep default | awk '{print $5}')

clear
echo "Écoute Discord en cours... Connecte-toi ou reconnecte-toi pour que les adresses IP apparaissent ici : "
declare -A resolved_domains
tcpdump -i $interface udp port 53 -n -s 0 -l 2>/dev/null | stdbuf -oL grep -oP '(?<=A\? )[^\s]+\.discord\.media' | while read domain; do
    if [ -z "${resolved_domains[$domain]}" ]; then
        ip=$(dig +short $domain | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1)
        if [ ! -z "$ip" ]; then
            printf "%-35s : %s\n" "$domain" "$ip"
            resolved_domains[$domain]=$ip
        fi
    fi
    sleep 1
done

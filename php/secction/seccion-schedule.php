


<?php
    // Configuración de la base de datos
    //// Legacy database configuration removed; use app/bootstrap.php. // Cambia esto si tu servidor de MySQL no está en localhost
    //// Legacy database configuration removed; use app/bootstrap.php. // Cambia esto a tu usuario de MySQL
    //// Legacy database configuration removed; use app/bootstrap.php. // Cambia esto a tu contraseña de MySQL
    //// Legacy database configuration removed; use app/bootstrap.php.

    // Legacy database configuration removed; use app/bootstrap.php. // Cambia esto si tu servidor de MySQL no está en localhost
    // Legacy database configuration removed; use app/bootstrap.php. // Cambia esto a tu usuario de MySQL
    // Legacy database configuration removed; use app/bootstrap.php. // Cambia esto a tu contraseña de MySQL
    // Legacy database configuration removed; use app/bootstrap.php.

    // Crear conexión
    $conn = new mysqli($servername, $username, $password, $dbname);

    // Verificar conexión
    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    } 
    
    function mostrarEquiposPorCategoria($conn) {
    // Consulta para obtener categorías, grupos y equipos con estadísticas
    $sql = "
        SELECT 
            c.name AS categoria, 
            g.name AS grupo, 
            t.name AS equipo,
            COUNT(DISTINCT gms.id) AS juegos,
            SUM(CASE WHEN gms.home_team_id = t.id AND gms.home_score > gms.guest_score THEN 1 
                     WHEN gms.guest_team_id = t.id AND gms.guest_score > gms.home_score THEN 1 
                     ELSE 0 END) AS ganados,
            SUM(CASE WHEN gms.home_team_id = t.id AND gms.home_score = gms.guest_score THEN 1 
                     WHEN gms.guest_team_id = t.id AND gms.guest_score = gms.home_score THEN 1 
                     ELSE 0 END) AS empates,
            SUM(CASE WHEN gms.home_team_id = t.id AND gms.home_score < gms.guest_score THEN 1 
                     WHEN gms.guest_team_id = t.id AND gms.guest_score < gms.home_score THEN 1 
                     ELSE 0 END) AS perdidos,
            SUM(CASE WHEN gms.home_team_id = t.id THEN gms.home_score 
                     WHEN gms.guest_team_id = t.id THEN gms.guest_score 
                     ELSE 0 END) AS goles_favor,
            SUM(CASE WHEN gms.home_team_id = t.id THEN gms.guest_score 
                     WHEN gms.guest_team_id = t.id THEN gms.home_score 
                     ELSE 0 END) AS goles_contra,
            (SUM(CASE WHEN gms.home_team_id = t.id THEN gms.home_score 
                      WHEN gms.guest_team_id = t.id THEN gms.guest_score 
                      ELSE 0 END) -
             SUM(CASE WHEN gms.home_team_id = t.id THEN gms.guest_score 
                      WHEN gms.guest_team_id = t.id THEN gms.home_score 
                      ELSE 0 END)) AS diferencia_goles,
            (SUM(CASE WHEN gms.home_team_id = t.id AND gms.home_score > gms.guest_score THEN 1 
                      WHEN gms.guest_team_id = t.id AND gms.guest_score > gms.home_score THEN 1 
                      ELSE 0 END) * 3 +
             SUM(CASE WHEN gms.home_team_id = t.id AND gms.home_score = gms.guest_score THEN 1 
                      WHEN gms.guest_team_id = t.id AND gms.guest_score = gms.home_score THEN 1 
                      ELSE 0 END)) AS puntos
        FROM teams t
        INNER JOIN group_teams gt ON t.id = gt.team_id
        INNER JOIN groups g ON gt.group_id = g.id
        INNER JOIN categories c ON g.category_id = c.id
        LEFT JOIN games gms ON (gms.home_team_id = t.id OR gms.guest_team_id = t.id)
        GROUP BY t.id, c.name, g.name, t.name
        ORDER BY c.name, g.name, t.name
    ";

    $result = $conn->query($sql);

    if ($result->num_rows > 0) {
        $currentCategory = null;
        $currentGroup = null;
        while ($row = $result->fetch_assoc()) {
            $categoria = $row['categoria'];
            $grupo = $row['grupo'];
            
            if ($categoria !== $currentCategory) {
                if ($currentCategory !== null) {
                    // Cerrar la tabla anterior
                    echo "</tbody></table>";
                }
                // Nueva categoría
                echo "<h2>{$categoria}</h2>";
                $currentCategory = $categoria;
                $currentGroup = null; // Reset group for new category
            }

            if ($grupo !== $currentGroup) {
                if ($currentGroup !== null) {
                    // Cerrar la tabla anterior de grupo
                    echo "</tbody></table>";
                }
                // Nuevo grupo
                echo "<h3>{$grupo}</h3>";
                echo "<table>
                        <thead>
                            <tr>
                                <th>Pos</th>
                                <th>Equipo</th>
                                <th>J</th>
                                <th>G</th>
                                <th>E</th>
                                <th>P</th>
                                <th>GF</th>
                                <th>GC</th>
                                <th>DF</th>
                                <th>Puntos</th>
                            </tr>
                        </thead>
                        <tbody>";
                $currentGroup = $grupo;
                $pos = 1; // Reset position counter for new group
            }

            // Datos del equipo
            echo "<tr>
                    <td>{$pos}</td>
                    <td>{$row['equipo']}</td>
                    <td>{$row['juegos']}</td>
                    <td>{$row['ganados']}</td>
                    <td>{$row['empates']}</td>
                    <td>{$row['perdidos']}</td>
                    <td>{$row['goles_favor']}</td>
                    <td>{$row['goles_contra']}</td>
                    <td>{$row['diferencia_goles']}</td>
                    <td>{$row['puntos']}</td>
                  </tr>";
            $pos++;
        }
        // Cerrar la última tabla abierta
        echo "</tbody></table>";
    } else {
        echo "<p>No hay datos disponibles</p>";
    }
}
?>
    -------------------
    
    function mostrarEquiposPorCategoria($conn) {
    // Consulta para obtener categorías, grupos y equipos
    $sql = "SELECT c.name AS categoria, g.name AS grupo, t.name AS equipo 
            FROM teams t
            INNER JOIN group_teams gt ON t.id = gt.team_id
            INNER JOIN groups g ON gt.group_id = g.id
            INNER JOIN categories c ON g.category_id = c.id
            ORDER BY c.name, g.name, t.name";

    $result = $conn->query($sql);

    // Almacenar los datos estructurados por categoría y grupo
    $data = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $categoria = $row['categoria'];
            $grupo = $row['grupo'];
            $equipo = $row['equipo'];
            $data[$categoria][$grupo][] = $equipo;
        }
    }

    // Generar la salida HTML
    if (!empty($data)) {
        foreach ($data as $categoria => $grupos) {
            echo "<h2 class='categoria'>$categoria</h2>";
            foreach ($grupos as $grupo => $equipos) {
                echo "<h3 class='grupo'>$grupo</h3>";
                echo "<table>
                        <thead>
                            <tr>
                                <th style='background-color: #000000'>Equipos</th>
                            </tr>
                        </thead>
                        <tbody>";
                
                foreach ($equipos as $equipo) {
                    echo "<tr><td class='text-black'>{$equipo}</td></tr>";
                }

                echo "</tbody></table><br>";
            }
        }
    } else {
        echo "<p>No hay datos disponibles</p>";
    }
}



    // Mostrar equipos por cada categoría
    
    // mostrarEquiposPorCategoria($conn, 'Premier');
    // mostrarEquiposPorCategoria($conn, 'Primera');
    // mostrarEquiposPorCategoria($conn, 'Femenil');

    // Cerrar conexión
    // $conn->close();
    ?>

?>




<div class="gdlr-core-pbf-wrapper " style="padding: 100px 0px 50px 0px;" id="gdlr-core-wrapper-2">
    <div class="gdlr-core-pbf-background-wrap"></div>
    <div class="gdlr-core-pbf-wrapper-content gdlr-core-js ">
        <div class="gdlr-core-pbf-wrapper-container clearfix gdlr-core-container">


            <div class="gdlr-core-pbf-column gdlr-core-column-60">
                <div class="gdlr-core-pbf-column-content-margin gdlr-core-js ">
                    <div class="gdlr-core-pbf-column-content clearfix gdlr-core-js ">
                        

                        <div class="container">
                            <div class="display-flex">
                                <h3> Categories </h3>
                            </div>
                        </div>

                        <div class="gdlr-core-pbf-element">
                            <div class="gdlr-core-text-box-item gdlr-core-item-pdlr gdlr-core-item-pdb gdlr-core-left-align gdlr-core-no-p-space"
                                style="padding-bottom: 0px ;">
                                <div class="gdlr-core-text-box-item-content" style="text-transform: none ;">
                                    <div class="sportspress sp-widget-align-none">
                                        <div class="sp-template sp-template-event-list">
                                            <h4 class="sp-table-caption bg-black" style="background-color: #18181f;"> PREMIER  </h4>
                                            <div class="sp-table-wrapper">
                                               <?php echo mostrarEquiposPorCategoria($conn, 'Premier')?>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="gdlr-core-pbf-element">
                            <div class="gdlr-core-text-box-item gdlr-core-item-pdlr gdlr-core-item-pdb gdlr-core-left-align gdlr-core-no-p-space"
                                style="padding-bottom: 0px ;">
                                <div class="gdlr-core-text-box-item-content" style="text-transform: none ;">
                                    <div class="sportspress sp-widget-align-none">
                                        <div class="sp-template sp-template-event-list">
                                            <h4 class="sp-table-caption">PRIMERA</h4>
                                            <div class="sp-table-wrapper">
                                               <?php echo mostrarEquiposPorCategoria($conn, 'Primera')?>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="gdlr-core-pbf-element">
                            <div class="gdlr-core-text-box-item gdlr-core-item-pdlr gdlr-core-item-pdb gdlr-core-left-align gdlr-core-no-p-space"
                                style="padding-bottom: 0px ;">
                                <div class="gdlr-core-text-box-item-content" style="text-transform: none ;">
                                    <div class="sportspress sp-widget-align-none">
                                        <div class="sp-template sp-template-event-list">
                                            <h4 class="sp-table-caption">FEMENIL</h4>
                                            <div class="sp-table-wrapper">
                                               <?php echo mostrarEquiposPorCategoria($conn, 'Femenil')?>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                      
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>


<?php $conn->close();?>